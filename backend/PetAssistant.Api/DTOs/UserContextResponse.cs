using PetAssistant.Api.Models;

namespace PetAssistant.Api.DTOs;

/// <summary>Contexto del usuario para el asistente: memoria larga, estado del avatar, estadísticas.</summary>
public class UserContextResponse
{
    public Guid UserId { get; set; }
    public List<UserMemoryItem> LongMemory { get; set; } = new();
    public AvatarState AvatarState { get; set; } = new();
    public int SessionCount { get; set; }
    public int MessageCount { get; set; }
}
