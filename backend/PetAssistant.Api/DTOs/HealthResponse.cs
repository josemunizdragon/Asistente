namespace PetAssistant.Api.DTOs;

public class HealthResponse
{
    public string Status { get; set; } = "Alive";
    public DateTime Timestamp { get; set; }
}
