namespace PetAssistant.Api.DTOs;

/// <summary>Respuesta al crear una sesión.</summary>
public class CreateSessionResponse
{
    public Guid SessionId { get; set; }
    public string Title { get; set; } = string.Empty;
}
