using PetAssistant.Api.DTOs;

namespace PetAssistant.Api.Services;

public interface IAssistantService
{
    WelcomeResponse GetWelcomeMessage(string? userName = null);
}
