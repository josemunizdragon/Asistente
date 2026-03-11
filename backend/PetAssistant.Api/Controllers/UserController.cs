using Microsoft.AspNetCore.Mvc;
using PetAssistant.Api.Services;

namespace PetAssistant.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UserController : ControllerBase
{
    private readonly IUserService _userService;

    public UserController(IUserService userService)
    {
        _userService = userService;
    }

    /// <summary>Perfil fake del usuario logueado (demo).</summary>
    [HttpGet("profile")]
    public IActionResult GetProfile()
    {
        var profile = _userService.GetProfile();
        return Ok(profile);
    }
}
