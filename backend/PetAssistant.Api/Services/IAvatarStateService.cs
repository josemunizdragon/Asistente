using PetAssistant.Api.Models;

namespace PetAssistant.Api.Services;

/// <summary>Estado del avatar: mood, energía, animación sugerida. Preparado para emociones, autonomía, etc.</summary>
public interface IAvatarStateService
{
    Task<AvatarState> GetOrCreateStateAsync(Guid userId, CancellationToken ct = default);
    Task<AvatarState> UpdateAfterInteractionAsync(Guid userId, string userMessage, string assistantReply, CancellationToken ct = default);
}
