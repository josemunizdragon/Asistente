namespace PetAssistant.Api.Models;

/// <summary>Sesión de conversación. Preparado para persistencia real (EF/SQL) después.</summary>
public class ConversationSession
{
    public Guid SessionId { get; set; }
    public Guid UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
