namespace PetAssistant.Api.Models;

/// <summary>Estado del avatar para animaciones y tono. Preparado para emociones, autonomía, hogar virtual, etc.</summary>
public class AvatarState
{
    public Guid UserId { get; set; }
    public string Mood { get; set; } = "calm";
    public string Energy { get; set; } = "medium";
    public string AttachmentLevel { get; set; } = "medium";
    public DateTime LastInteractionAtUtc { get; set; }
    public int ConsecutiveDaysActive { get; set; }
    public string? CurrentNeed { get; set; }
    public string? SuggestedAnimation { get; set; }
    public string? SuggestedVoiceTone { get; set; }
}
