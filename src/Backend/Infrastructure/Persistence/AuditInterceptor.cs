using System.Text.Json;
using Application;
using Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Infrastructure.Persistence;

internal sealed class AuditInterceptor(ICurrentUserAccessor currentUser) : SaveChangesInterceptor
{
    private static readonly HashSet<Type> _excluded =
    [
        typeof(ChangeAuditLog),
        typeof(AuthAuditLog),
        typeof(AuthSession),
        typeof(SurveyResponse),
        typeof(SurveyResponseAnswer),
    ];

    private static readonly JsonSerializerOptions _jsonOptions = new() { WriteIndented = false };
    private readonly List<PendingCreateAudit> _pendingCreateAudits = [];
    private bool _isFinalizingCreateAudits;

    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        AddAuditLogs(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        AddAuditLogs(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        FinalizeCreateAudits(eventData.Context);
        return base.SavedChanges(eventData, result);
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        await FinalizeCreateAuditsAsync(eventData.Context, cancellationToken);
        return await base.SavedChangesAsync(eventData, result, cancellationToken);
    }

    public override void SaveChangesFailed(DbContextErrorEventData eventData)
    {
        _pendingCreateAudits.Clear();
        _isFinalizingCreateAudits = false;
        base.SaveChangesFailed(eventData);
    }

    public override Task SaveChangesFailedAsync(
        DbContextErrorEventData eventData,
        CancellationToken cancellationToken = default)
    {
        _pendingCreateAudits.Clear();
        _isFinalizingCreateAudits = false;
        return base.SaveChangesFailedAsync(eventData, cancellationToken);
    }

    private void AddAuditLogs(DbContext? context)
    {
        if (context is null || _isFinalizingCreateAudits)
            return;

        var now = DateTime.UtcNow;
        var userId = currentUser.UserId;
        var userEmail = currentUser.UserEmail;
        var logs = new List<ChangeAuditLog>();

        foreach (var entry in context.ChangeTracker.Entries().ToList())
        {
            if (_excluded.Contains(entry.Entity.GetType())) continue;
            if (entry.State is EntityState.Detached or EntityState.Unchanged) continue;

            string action;
            string? oldValues = null;
            string? newValues = null;

            if (entry.State == EntityState.Deleted && entry.Entity is ISoftDeletable softDeletable)
            {
                // Intercept hard delete: convert to soft delete
                softDeletable.IsDeleted = true;
                softDeletable.DeletedAt = now;
                entry.State = EntityState.Modified;
                action = "DELETE";
                oldValues = Serialize(entry, original: true);
            }
            else if (entry.State == EntityState.Added)
            {
                action = "CREATE";
                newValues = Serialize(entry, original: false);
            }
            else if (entry.State == EntityState.Modified)
            {
                if (entry.Entity is ISoftDeletable sd)
                {
                    var wasDeleted = entry.Property(nameof(ISoftDeletable.IsDeleted)).OriginalValue is true;
                    if (!wasDeleted && sd.IsDeleted)
                    {
                        action = "DELETE";
                        oldValues = Serialize(entry, original: true);
                    }
                    else if (wasDeleted && !sd.IsDeleted)
                    {
                        action = "RESTORE";
                        oldValues = Serialize(entry, original: true);
                        newValues = Serialize(entry, original: false);
                    }
                    else
                    {
                        action = "UPDATE";
                        oldValues = Serialize(entry, original: true);
                        newValues = Serialize(entry, original: false);
                    }
                }
                else
                {
                    action = "UPDATE";
                    oldValues = Serialize(entry, original: true);
                    newValues = Serialize(entry, original: false);
                }
            }
            else
            {
                continue;
            }

            var log = new ChangeAuditLog
            {
                Id = Guid.NewGuid(),
                TableName = entry.Metadata.ClrType.Name,
                RecordId = GetPrimaryKeyString(entry),
                Action = action,
                ChangedBy = userId,
                ChangedByEmail = userEmail,
                OldValues = oldValues,
                NewValues = newValues,
                ChangedAt = now,
            };

            logs.Add(log);

            // Database-generated keys are temporary (usually negative) until the
            // insert completes. Keep the tracked entry so the audit row can be
            // corrected with the final key and any propagated foreign keys.
            if (entry.State == EntityState.Added)
                _pendingCreateAudits.Add(new PendingCreateAudit(entry, log));
        }

        foreach (var log in logs)
            context.Set<ChangeAuditLog>().Add(log);
    }

    private void FinalizeCreateAudits(DbContext? context)
    {
        if (context is null || _isFinalizingCreateAudits || _pendingCreateAudits.Count == 0)
            return;

        var pending = TakePendingCreateAudits();
        try
        {
            UpdateCreateAuditValues(pending);
            context.SaveChanges();
        }
        finally
        {
            _isFinalizingCreateAudits = false;
        }
    }

    private async Task FinalizeCreateAuditsAsync(DbContext? context, CancellationToken cancellationToken)
    {
        if (context is null || _isFinalizingCreateAudits || _pendingCreateAudits.Count == 0)
            return;

        var pending = TakePendingCreateAudits();
        try
        {
            UpdateCreateAuditValues(pending);
            await context.SaveChangesAsync(cancellationToken);
        }
        finally
        {
            _isFinalizingCreateAudits = false;
        }
    }

    private List<PendingCreateAudit> TakePendingCreateAudits()
    {
        _isFinalizingCreateAudits = true;
        var pending = _pendingCreateAudits.ToList();
        _pendingCreateAudits.Clear();
        return pending;
    }

    private static void UpdateCreateAuditValues(IEnumerable<PendingCreateAudit> pending)
    {
        foreach (var item in pending)
        {
            item.Log.RecordId = GetPrimaryKeyString(item.Entry);
            item.Log.NewValues = Serialize(item.Entry, original: false);
        }
    }

    private static string GetPrimaryKeyString(EntityEntry entry)
    {
        var pkProps = entry.Metadata.FindPrimaryKey()?.Properties;
        if (pkProps is null) return string.Empty;

        return string.Join(",", pkProps.Select(p =>
        {
            var prop = entry.Property(p.Name);
            return (prop.CurrentValue ?? prop.OriginalValue)?.ToString() ?? "";
        }));
    }

    private static string Serialize(EntityEntry entry, bool original)
    {
        var dict = new Dictionary<string, object?>(entry.Properties.Count());
        foreach (var prop in entry.Properties)
            dict[prop.Metadata.Name] = original ? prop.OriginalValue : prop.CurrentValue;
        return JsonSerializer.Serialize(dict, _jsonOptions);
    }

    private sealed record PendingCreateAudit(EntityEntry Entry, ChangeAuditLog Log);
}
