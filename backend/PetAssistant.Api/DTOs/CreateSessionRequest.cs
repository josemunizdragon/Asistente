namespace PetAssistant.Api.DTOs;

/// <summary>Request para crear una nueva sesión de conversación.</summary>
public class CreateSessionRequest
{
    public Guid? UserId { get; set; }
    public string? Title { get; set; }
}
