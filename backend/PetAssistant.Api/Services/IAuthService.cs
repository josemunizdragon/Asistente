using PetAssistant.Api.DTOs;

namespace PetAssistant.Api.Services;

public interface IAuthService
{
    LoginResponse Login(LoginRequest request);
    SignupResponse Signup(SignupRequest request);
}
