namespace PetAssistant.Api.Models;

/// <summary>Mensaje dentro de una sesión. Role: system, user, assistant, tool.</summary>
public class ConversationMessage
{
    public Guid Id { get; set; }
    public Guid SessionId { get; set; }
    public string Role { get; set; } = "user";
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public bool IsQuickReply { get; set; }
    public string? Intent { get; set; }
}
