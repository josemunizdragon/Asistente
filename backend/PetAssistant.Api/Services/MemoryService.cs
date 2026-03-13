using PetAssistant.Api.Data;
using PetAssistant.Api.Models;

namespace PetAssistant.Api.Services;

/// <summary>Implementación en memoria. Try/catch en puntos sensibles.</summary>
public class MemoryService : IMemoryService
{
    private readonly InMemoryStore _store;

    public MemoryService(InMemoryStore store)
    {
        _store = store;
    }

    public Task SaveMemoryItemsAsync(List<UserMemoryItem> items, CancellationToken ct = default)
    {
        try
        {
            if (items == null || items.Count == 0) return Task.CompletedTask;
            _store.AddMemories(items);
            return Task.CompletedTask;
        }
        catch (Exception)
        {
            return Task.CompletedTask;
        }
    }

    public Task<List<UserMemoryItem>> GetUserMemoriesAsync(Guid userId, CancellationToken ct = default)
    {
        try
        {
            var list = _store.GetMemories(userId);
            return Task.FromResult(list);
        }
        catch (Exception)
        {
            return Task.FromResult(new List<UserMemoryItem>());
        }
    }

    public Task<List<ConversationMessage>> GetRecentConversationAsync(Guid sessionId, int maxItems, CancellationToken ct = default)
    {
        try
        {
            var list = _store.GetMessages(sessionId, maxItems);
            return Task.FromResult(list);
        }
        catch (Exception)
        {
            return Task.FromResult(new List<ConversationMessage>());
        }
    }
}
