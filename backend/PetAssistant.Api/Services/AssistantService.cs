using PetAssistant.Api.DTOs;

namespace PetAssistant.Api.Services;

/// <summary>Servicio del asistente virtual fake para demo.</summary>
public class AssistantService : IAssistantService
{
    public WelcomeResponse GetWelcomeMessage(string? userName = null)
    {
        var name = string.IsNullOrWhiteSpace(userName) ? "Usuario" : userName;
        return new WelcomeResponse
        {
            Message = $"Hola {name}, soy tu asistente virtual."
        };
    }
}
