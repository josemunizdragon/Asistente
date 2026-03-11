using PetAssistant.Api.DTOs;

namespace PetAssistant.Api.Services;

/// <summary>Servicio de perfil de usuario fake para demo.</summary>
public class UserService : IUserService
{
    public UserProfileResponse GetProfile()
    {
        return new UserProfileResponse
        {
            Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
            Name = "Usuario Demo",
            Email = "demo@petassistant.com",
            Role = "User",
            AssistantName = "Asistente Mascotas"
        };
    }
}
