using System.Net.Http.Json;
using Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class AgentMemoryService : IAgentMemoryService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<AgentMemoryService> _logger;
    private readonly string _baseUrl;

    public AgentMemoryService(HttpClient httpClient, IConfiguration configuration, ILogger<AgentMemoryService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _baseUrl = configuration["AgentMemory:BaseUrl"] ?? "http://localhost:3111";
    }

    public async Task<bool> SaveMemoryAsync(MemorySaveRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            var payload = new
            {
                content = request.Content,
                concepts = request.Tags ?? Array.Empty<string>()
            };

            var response = await _httpClient.PostAsJsonAsync($"{_baseUrl}/agentmemory/remember", payload, cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save memory to AgentMemory at {Url}", _baseUrl);
            return false;
        }
    }

    public async Task<IEnumerable<MemoryResult>> RecallMemoryAsync(MemoryRecallRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            var payload = new { query = request.Query };
            var response = await _httpClient.PostAsJsonAsync($"{_baseUrl}/agentmemory/search", payload, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return Enumerable.Empty<MemoryResult>();
            }

            using var doc = await System.Text.Json.JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
            var list = new List<MemoryResult>();

            if (doc.RootElement.TryGetProperty("results", out var resultsElem) && resultsElem.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                foreach (var item in resultsElem.EnumerateArray())
                {
                    var score = item.TryGetProperty("score", out var s) ? s.GetDouble() : 0.0;
                    var content = request.Query;
                    var id = "mem_" + Guid.NewGuid().ToString("N");

                    if (item.TryGetProperty("observation", out var obs))
                    {
                        if (obs.TryGetProperty("id", out var idProp)) id = idProp.GetString() ?? id;
                        if (obs.TryGetProperty("narrative", out var nProp)) content = nProp.GetString() ?? content;
                        else if (obs.TryGetProperty("facts", out var fProp) && fProp.ValueKind == System.Text.Json.JsonValueKind.Array && fProp.GetArrayLength() > 0)
                        {
                            content = fProp[0].GetString() ?? content;
                        }
                    }

                    list.Add(new MemoryResult(id, content, score, null));
                }
            }

            return list;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to recall memory from AgentMemory at {Url}", _baseUrl);
            return Enumerable.Empty<MemoryResult>();
        }
    }

    public async Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.GetAsync($"{_baseUrl}/agentmemory/health", cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }
}
