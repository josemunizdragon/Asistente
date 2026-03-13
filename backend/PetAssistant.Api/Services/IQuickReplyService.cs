using PetAssistant.Api.DTOs;

namespace PetAssistant.Api.Services;

/// <summary>Resuelve respuestas rápidas para saludos, gracias, etc. sin llamar a OpenAI.</summary>
public interface IQuickReplyService
{
    QuickReplyResult TryResolve(string input, string? assistantName = null);
}
