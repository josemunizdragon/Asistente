using Microsoft.AspNetCore.Mvc;
using PetAssistant.Api.Data;
using PetAssistant.Api.DTOs;
using PetAssistant.Api.Models;
using PetAssistant.Api.Services;

namespace PetAssistant.Api.Controllers;

/// <summary>Memoria larga del usuario y contexto. Preparado para STT/TTS, recordatorios, etc.</summary>
[ApiController]
[Route("api/[controller]")]
public class MemoryController : ControllerBase
{
    private readonly IMemoryService _memory;
    private readonly IAvatarStateService _avatarState;
    private readonly InMemoryStore _store;

    public MemoryController(IMemoryService memory, IAvatarStateService avatarState, InMemoryStore store)
    {
        _memory = memory;
        _avatarState = avatarState;
        _store = store;
    }

    /// <summary>Obtiene las memorias guardadas del usuario.</summary>
    [HttpGet("{userId:guid}")]
    public async Task<ActionResult<ApiResponse<List<UserMemoryItemDto>>>> GetMemories(Guid userId, CancellationToken ct)
    {
        try
        {
            var items = await _memory.GetUserMemoriesAsync(userId, ct);
            var dtos = items.Select(m => new UserMemoryItemDto
            {
                Id = m.Id,
                UserId = m.UserId,
                Category = m.Category,
                Key = m.Key,
                Value = m.Value,
                Importance = m.Importance,
                CreatedAtUtc = m.CreatedAtUtc,
                UpdatedAtUtc = m.UpdatedAtUtc
            }).ToList();
            return Ok(ApiResponse<List<UserMemoryItemDto>>.Ok(dtos, "OK"));
        }
        catch (Exception ex)
        {
            return Ok(ApiResponse<List<UserMemoryItemDto>>.Fail(ex.Message, "GET_MEMORIES_ERROR"));
        }
    }

    /// <summary>Obtiene contexto completo del usuario: memoria larga, estado del avatar, estadísticas.</summary>
    [HttpGet("{userId:guid}/context")]
    public async Task<ActionResult<ApiResponse<UserContextResponse>>> GetContext(Guid userId, CancellationToken ct)
    {
        try
        {
            var longMemory = await _memory.GetUserMemoriesAsync(userId, ct);
            var avatarState = await _avatarState.GetOrCreateStateAsync(userId, ct);
            var sessions = _store.GetSessionsByUser(userId);
            var messageCount = sessions.Sum(s => _store.GetMessages(s.SessionId).Count);

            var response = new UserContextResponse
            {
                UserId = userId,
                LongMemory = longMemory,
                AvatarState = avatarState,
                SessionCount = sessions.Count,
                MessageCount = messageCount
            };
            return Ok(ApiResponse<UserContextResponse>.Ok(response, "OK"));
        }
        catch (Exception ex)
        {
            return Ok(ApiResponse<UserContextResponse>.Fail(ex.Message, "GET_CONTEXT_ERROR"));
        }
    }
}

/// <summary>DTO para item de memoria en respuestas API.</summary>
public class UserMemoryItemDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public double Importance { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
