using Microsoft.AspNetCore.Mvc;
using PetAssistant.Api.DTOs;
using PetAssistant.Api.Models;
using PetAssistant.Api.Services;

namespace PetAssistant.Api.Controllers;

/// <summary>Sesiones y mensajes del asistente conversacional. Respuestas ApiResponse&lt;T&gt;.</summary>
[ApiController]
[Route("api/[controller]")]
public class ConversationController : ControllerBase
{
    private readonly IConversationService _conversation;

    public ConversationController(IConversationService conversation)
    {
        _conversation = conversation;
    }

    /// <summary>Crea una nueva sesión de conversación.</summary>
    [HttpPost("session/create")]
    public async Task<ActionResult<ApiResponse<CreateSessionResponse>>> CreateSession([FromBody] CreateSessionRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _conversation.CreateSessionAsync(request ?? new CreateSessionRequest(), ct);
            return Ok(ApiResponse<CreateSessionResponse>.Ok(result, "Sesión creada"));
        }
        catch (Exception ex)
        {
            return Ok(ApiResponse<CreateSessionResponse>.Fail(ex.Message, "CREATE_SESSION_ERROR"));
        }
    }

    /// <summary>Envía un mensaje al asistente y obtiene la respuesta con mood y animación sugerida.</summary>
    [HttpPost("message")]
    public async Task<ActionResult<ApiResponse<AssistantChatResponse>>> SendMessage([FromBody] AssistantChatRequest request, CancellationToken ct)
    {
        try
        {
            if (request == null)
                return Ok(ApiResponse<AssistantChatResponse>.Fail("Request inválido", "INVALID_REQUEST"));
            var result = await _conversation.SendMessageAsync(request, ct);
            return Ok(ApiResponse<AssistantChatResponse>.Ok(result, "OK"));
        }
        catch (Exception ex)
        {
            return Ok(ApiResponse<AssistantChatResponse>.Fail(ex.Message, "SEND_MESSAGE_ERROR"));
        }
    }

    /// <summary>Obtiene los mensajes recientes de una sesión.</summary>
    [HttpGet("{sessionId:guid}/messages")]
    public async Task<ActionResult<ApiResponse<List<ConversationMessageDto>>>> GetMessages(Guid sessionId, CancellationToken ct)
    {
        try
        {
            var messages = await _conversation.GetMessagesAsync(sessionId, ct);
            var dtos = messages.Select(m => new ConversationMessageDto
            {
                Id = m.Id,
                SessionId = m.SessionId,
                Role = m.Role,
                Content = m.Content,
                CreatedAtUtc = m.CreatedAtUtc,
                IsQuickReply = m.IsQuickReply,
                Intent = m.Intent
            }).ToList();
            return Ok(ApiResponse<List<ConversationMessageDto>>.Ok(dtos, "OK"));
        }
        catch (Exception ex)
        {
            return Ok(ApiResponse<List<ConversationMessageDto>>.Fail(ex.Message, "GET_MESSAGES_ERROR"));
        }
    }
}

/// <summary>DTO para mensaje en respuestas API.</summary>
public class ConversationMessageDto
{
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public string Role { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public bool IsQuickReply { get; set; }
    public string? Intent { get; set; }
}
