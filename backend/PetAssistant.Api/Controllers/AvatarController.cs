using Microsoft.AspNetCore.Mvc;
using PetAssistant.Api.DTOs;
using PetAssistant.Api.Services;

namespace PetAssistant.Api.Controllers;

/// <summary>Estado del avatar: mood, animación sugerida, tono de voz. Preparado para emociones, autonomía.</summary>
[ApiController]
[Route("api/[controller]")]
public class AvatarController : ControllerBase
{
    private readonly IAvatarStateService _avatarState;

    public AvatarController(IAvatarStateService avatarState)
    {
        _avatarState = avatarState;
    }

    /// <summary>Obtiene el estado actual del avatar para el usuario (mood, suggestedAnimation, suggestedVoiceTone).</summary>
    [HttpGet("{userId:guid}/state")]
    public async Task<ActionResult<ApiResponse<AvatarStateDto>>> GetState(Guid userId, CancellationToken ct)
    {
        try
        {
            var state = await _avatarState.GetOrCreateStateAsync(userId, ct);
            var dto = new AvatarStateDto
            {
                UserId = state.UserId,
                Mood = state.Mood,
                Energy = state.Energy,
                AttachmentLevel = state.AttachmentLevel,
                LastInteractionAtUtc = state.LastInteractionAtUtc,
                ConsecutiveDaysActive = state.ConsecutiveDaysActive,
                CurrentNeed = state.CurrentNeed,
                SuggestedAnimation = state.SuggestedAnimation ?? "idle",
                SuggestedVoiceTone = state.SuggestedVoiceTone ?? "warm"
            };
            return Ok(ApiResponse<AvatarStateDto>.Ok(dto, "OK"));
        }
        catch (Exception ex)
        {
            return Ok(ApiResponse<AvatarStateDto>.Fail(ex.Message, "GET_AVATAR_STATE_ERROR"));
        }
    }
}

/// <summary>DTO del estado del avatar en respuestas API.</summary>
public class AvatarStateDto
{
    public Guid UserId { get; set; }
    public string Mood { get; set; } = "calm";
    public string Energy { get; set; } = "medium";
    public string AttachmentLevel { get; set; } = "medium";
    public DateTime LastInteractionAtUtc { get; set; }
    public int ConsecutiveDaysActive { get; set; }
    public string? CurrentNeed { get; set; }
    public string SuggestedAnimation { get; set; } = "idle";
    public string SuggestedVoiceTone { get; set; } = "warm";
}
