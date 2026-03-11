using Microsoft.AspNetCore.Mvc;
using PetAssistant.Api.DTOs;

namespace PetAssistant.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    /// <summary>Comprueba que la API está viva.</summary>
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new HealthResponse
        {
            Status = "Alive",
            Timestamp = DateTime.UtcNow
        });
    }
}
