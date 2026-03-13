using PetAssistant.Api.DTOs;
using PetAssistant.Api.Models;

namespace PetAssistant.Api.Services;

/// <summary>Servicio de OpenAI para respuestas y extracción de memoria. Mockeable con UseMockOpenAI.</summary>
public interface IOpenAiService
{
    Task<string> GetAssistantReplyAsync(string systemPrompt, string userMessage, List<ConversationMessage> shortMemory, CancellationToken ct = default);
    Task<MemoryExtractResult> ExtractMemoryAsync(Guid userId, string userMessage, string assistantReply, CancellationToken ct = default);
}
