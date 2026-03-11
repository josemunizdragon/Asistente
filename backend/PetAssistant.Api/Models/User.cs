namespace PetAssistant.Api.Models;

/// <summary>Modelo de usuario para uso interno (demo, sin persistencia).</summary>
public class User
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "User";
    public string AssistantName { get; set; } = "Asistente Mascotas";
}
