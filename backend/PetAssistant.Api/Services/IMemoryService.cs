using PetAssistant.Api.Models;

namespace PetAssistant.Api.Services;

/// <summary>Memoria larga del usuario y mensajes recientes. Preparado para EF.</summary>
public interface IMemoryService
{
    Task SaveMemoryItemsAsync(List<UserMemoryItem> items, CancellationToken ct = default);
    Task<List<UserMemoryItem>> GetUserMemoriesAsync(Guid userId, CancellationToken ct = default);
    Task<List<ConversationMessage>> GetRecentConversationAsync(Guid sessionId, int maxItems, CancellationToken ct = default);
}
