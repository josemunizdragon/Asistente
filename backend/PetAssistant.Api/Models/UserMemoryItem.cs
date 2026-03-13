namespace PetAssistant.Api.Models;

/// <summary>Elemento de memoria larga del usuario. Category: preference, important_date, relationship, profile, reminder_hint, emotional_pattern.</summary>
public class UserMemoryItem
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Category { get; set; } = "preference";
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public double Importance { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
