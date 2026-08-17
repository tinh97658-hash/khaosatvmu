namespace Application.Common.Interfaces;

public record MemorySaveRequest(string Content, string[]? Tags);
public record MemoryRecallRequest(string Query);
public record MemoryResult(string Id, string Content, double Score, string? Metadata);

public interface IAgentMemoryService
{
    Task<bool> SaveMemoryAsync(MemorySaveRequest request, CancellationToken cancellationToken = default);
    Task<IEnumerable<MemoryResult>> RecallMemoryAsync(MemoryRecallRequest request, CancellationToken cancellationToken = default);
    Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default);
}
