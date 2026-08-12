namespace Application.Common.Interfaces;

public record MemorySaveRequest(string Content, string[]? Tags = null, string? Category = null);
public record MemoryRecallRequest(string Query, int Limit = 5);
public record MemoryResult(string Id, string Content, double Score, string[]? Tags);

public interface IAgentMemoryService
{
    Task<bool> SaveMemoryAsync(MemorySaveRequest request, CancellationToken cancellationToken = default);
    Task<IEnumerable<MemoryResult>> RecallMemoryAsync(MemoryRecallRequest request, CancellationToken cancellationToken = default);
    Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default);
}
