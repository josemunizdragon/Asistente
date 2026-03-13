namespace PetAssistant.Api.DTOs;

/// <summary>Respuesta del asistente tras procesar un mensaje.</summary>
public class AssistantChatResponse
{
    public Guid SessionId { get; set; }
    public string Reply { get; set; } = string.Empty;
    public string Mood { get; set; } = "calm";
    public string SuggestedAnimation { get; set; } = "idle";
    public string SuggestedVoiceTone { get; set; } = "warm";
    public bool UsedQuickReply { get; set; }
    public bool SavedMemory { get; set; }
    public List<string> MemoryHints { get; set; } = new();
    public List<string> FollowUpSuggestions { get; set; } = new();
}
