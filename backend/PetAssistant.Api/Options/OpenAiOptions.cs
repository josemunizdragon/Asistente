namespace PetAssistant.Api.Options;

/// <summary>Configuración de OpenAI. Leer desde appsettings "OpenAI".</summary>
public class OpenAiOptions
{
    public const string SectionName = "OpenAI";

    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "gpt-4.1-mini";
    public string FastModel { get; set; } = "gpt-4.1-mini";
}
