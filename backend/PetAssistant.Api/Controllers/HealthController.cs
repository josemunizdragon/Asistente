using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using PetAssistant.Api.DTOs;
using PetAssistant.Api.Options;

namespace PetAssistant.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly IOptions<OpenAiOptions> _openAi;
    private readonly IOptions<AssistantOptions> _assistant;

    public HealthController(IOptions<OpenAiOptions> openAi, IOptions<AssistantOptions> assistant)
    {
        _openAi = openAi;
        _assistant = assistant;
    }

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

    /// <summary>Detalle de salud: configuración OpenAI, flags del asistente (mock, quick replies, memoria larga).</summary>
    [HttpGet("details")]
    public IActionResult GetDetails()
    {
        try
        {
            var o = _openAi?.Value;
            var a = _assistant?.Value;
            return Ok(new HealthDetailsResponse
            {
                Status = "Healthy",
                Timestamp = DateTime.UtcNow,
                OpenAiConfigured = !string.IsNullOrWhiteSpace(o?.ApiKey),
                UseMockOpenAi = a?.UseMockOpenAI ?? true,
                QuickRepliesEnabled = a?.EnableQuickReplies ?? true,
                LongMemoryEnabled = a?.EnableLongMemory ?? true
            });
        }
        catch (Exception)
        {
            return Ok(new HealthDetailsResponse
            {
                Status = "Healthy",
                Timestamp = DateTime.UtcNow,
                OpenAiConfigured = false,
                UseMockOpenAi = true,
                QuickRepliesEnabled = true,
                LongMemoryEnabled = true
            });
        }
    }
}
