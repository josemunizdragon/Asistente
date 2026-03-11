using PetAssistant.Api.DTOs;

namespace PetAssistant.Api.Services;

/// <summary>Servicio de autenticación fake para demo. No valida credenciales reales.</summary>
public class AuthService : IAuthService
{
    public LoginResponse Login(LoginRequest request)
    {
        var hasCredentials = !string.IsNullOrWhiteSpace(request.Email) && !string.IsNullOrWhiteSpace(request.Password);
        return new LoginResponse
        {
            Success = hasCredentials,
            Token = hasCredentials ? "demo-token-" + Guid.NewGuid().ToString("N")[..16] : string.Empty,
            User = hasCredentials
                ? new UserDto
                {
                    Id = Guid.NewGuid(),
                    Name = request.Email.Split('@')[0],
                    Email = request.Email
                }
                : null
        };
    }

    public SignupResponse Signup(SignupRequest request)
    {
        return new SignupResponse
        {
            Success = true,
            Message = "Cuenta creada correctamente"
        };
    }
}
