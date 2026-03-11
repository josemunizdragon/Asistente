using Microsoft.AspNetCore.Mvc;
using PetAssistant.Api.Services;

namespace PetAssistant.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AssistantController : ControllerBase
{
    private readonly IAssistantService _assistantService;

    public AssistantController(IAssistantService assistantService)
    {
        _assistantService = assistantService;
    }

    /// <summary>Mensaje de bienvenida del asistente. Opcional: ?userName=Jose</summary>
    [HttpGet("welcome")]
    public IActionResult GetWelcome([FromQuery] string? userName = null)
    {
        var response = _assistantService.GetWelcomeMessage(userName);
        return Ok(response);
    }
}
