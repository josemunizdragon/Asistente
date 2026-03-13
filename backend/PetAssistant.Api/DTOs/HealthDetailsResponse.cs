namespace PetAssistant.Api.DTOs;

/// <summary>Detalle de salud de la API: configuración OpenAI, flags del asistente.</summary>
public class HealthDetailsResponse
{
    public string Status { get; set; } = "Healthy";
    public DateTime Timestamp { get; set; }
    public bool OpenAiConfigured { get; set; }
    public bool UseMockOpenAi { get; set; }
    public bool QuickRepliesEnabled { get; set; }
    public bool LongMemoryEnabled { get; set; }
}
