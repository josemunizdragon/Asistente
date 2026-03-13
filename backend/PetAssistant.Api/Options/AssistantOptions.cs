namespace PetAssistant.Api.Options;

/// <summary>Configuración del asistente virtual. Leer desde appsettings "Assistant".</summary>
public class AssistantOptions
{
    public const string SectionName = "Assistant";

    public string Name { get; set; } = "Basthelo";
    public string SystemPrompt { get; set; } = string.Empty;
    public bool UseMockOpenAI { get; set; } = true;
    public bool EnableLongMemory { get; set; } = true;
    public bool EnableQuickReplies { get; set; } = true;
    public bool ReturnVoiceHints { get; set; } = true;
}
