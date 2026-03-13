using PetAssistant.Api.DTOs;
using PetAssistant.Api.Models;

namespace PetAssistant.Api.Services;

/// <summary>Creación de sesiones, envío de mensajes y obtención de historial.</summary>
public interface IConversationService
{
    Task<CreateSessionResponse> CreateSessionAsync(CreateSessionRequest request, CancellationToken ct = default);
    Task<AssistantChatResponse> SendMessageAsync(AssistantChatRequest request, CancellationToken ct = default);
    Task<List<ConversationMessage>> GetMessagesAsync(Guid sessionId, CancellationToken ct = default);
}
