using PetAssistant.Api.Data;
using PetAssistant.Api.Models;

namespace PetAssistant.Api.Services;

/// <summary>Mantiene estado del avatar en memoria. Actualiza mood/animación según interacción.</summary>
public class AvatarStateService : IAvatarStateService
{
    private readonly InMemoryStore _store;

    public AvatarStateService(InMemoryStore store)
    {
        _store = store;
    }

    public Task<AvatarState> GetOrCreateStateAsync(Guid userId, CancellationToken ct = default)
    {
        try
        {
            var state = _store.GetAvatarState(userId);
            if (state != null) return Task.FromResult(state);

            state = new AvatarState
            {
                UserId = userId,
                Mood = "calm",
                Energy = "medium",
                AttachmentLevel = "medium",
                LastInteractionAtUtc = DateTime.UtcNow,
                ConsecutiveDaysActive = 1,
                SuggestedAnimation = "idle",
                SuggestedVoiceTone = "warm"
            };
            _store.SetAvatarState(state);
            return Task.FromResult(state);
        }
        catch (Exception)
        {
            return Task.FromResult(new AvatarState { UserId = userId, Mood = "calm", SuggestedAnimation = "idle", SuggestedVoiceTone = "warm" });
        }
    }

    public Task<AvatarState> UpdateAfterInteractionAsync(Guid userId, string userMessage, string assistantReply, CancellationToken ct = default)
    {
        try
        {
            var state = _store.GetAvatarState(userId) ?? new AvatarState { UserId = userId };
            state.LastInteractionAtUtc = DateTime.UtcNow;
            state.Mood = InferMoodFromReply(assistantReply);
            state.SuggestedAnimation = "idle";
            state.SuggestedVoiceTone = "warm";
            _store.SetAvatarState(state);
            return Task.FromResult(state);
        }
        catch (Exception)
        {
            return GetOrCreateStateAsync(userId, ct);
        }
    }

    private static string InferMoodFromReply(string reply)
    {
        var r = (reply ?? "").ToLowerInvariant();
        if (r.Contains("alegr") || r.Contains("genial") || r.Contains("¡hola")) return "happy";
        if (r.Contains("lamento") || r.Contains("triste")) return "sad";
        if (r.Contains("?")) return "curious";
        return "calm";
    }
}
