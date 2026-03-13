namespace PetAssistant.Api.DTOs;

/// <summary>Resultado de intentar resolver una respuesta rápida (saludo, gracias, etc.).</summary>
public class QuickReplyResult
{
    public bool Matched { get; set; }
    public string? Intent { get; set; }
    public string? Response { get; set; }
    public string? Mood { get; set; }
    public string? SuggestedAnimation { get; set; }
    public string? SuggestedVoiceTone { get; set; }
}
