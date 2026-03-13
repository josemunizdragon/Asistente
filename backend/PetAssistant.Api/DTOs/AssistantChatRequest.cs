namespace PetAssistant.Api.DTOs;

/// <summary>Request para enviar un mensaje al asistente.</summary>
public class AssistantChatRequest
{
    public Guid? UserId { get; set; }
    public Guid? SessionId { get; set; }
    public string Message { get; set; } = string.Empty;
    public bool UseQuickReply { get; set; } = true;
    public bool SaveMemory { get; set; } = true;
    public bool ReturnVoiceHints { get; set; } = true;
    public string? ClientTimestamp { get; set; }
    public string? Locale { get; set; }
}
