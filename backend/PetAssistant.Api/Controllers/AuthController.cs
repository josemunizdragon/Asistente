using Microsoft.AspNetCore.Mvc;
using PetAssistant.Api.DTOs;
using PetAssistant.Api.Services;

namespace PetAssistant.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    /// <summary>Login de demo: devuelve success si email y password vienen informados.</summary>
    [HttpPost("login")]
    public ActionResult<LoginResponse> Login([FromBody] LoginRequest request)
    {
        var result = _authService.Login(request);
        return Ok(result);
    }

    /// <summary>Registro de demo: siempre responde success con mensaje de cuenta creada.</summary>
    [HttpPost("signup")]
    public ActionResult<SignupResponse> Signup([FromBody] SignupRequest request)
    {
        var result = _authService.Signup(request);
        return Ok(result);
    }
}
