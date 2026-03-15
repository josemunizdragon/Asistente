namespace PetAssistant.Api.DTOs;

/// <summary>Respuesta del asistente tras procesar un mensaje. replyText es el texto limpio para usuario y TTS; mood/animation/tone son metadatos del avatar.</summary>
public class AssistantChatResponse
{
    public Guid SessionId { get; set; }
    /// <summary>Texto limpio para mostrar y TTS (sin emojis ni metadatos).</summary>
    public string ReplyText { get; set; } = string.Empty;
    /// <summary>Obsoleto: use ReplyText. Se mantiene igual que ReplyText por compatibilidad.</summary>
    public string Reply { get; set; } = string.Empty;
    public string? Mood { get; set; }
    public string? SuggestedAnimation { get; set; }
    public string? SuggestedVoiceTone { get; set; }
    public bool UsedQuickReply { get; set; }
    public bool SavedMemory { get; set; }
    public List<string> MemoryHints { get; set; } = new();
    public List<string> FollowUpSuggestions { get; set; } = new();
}
