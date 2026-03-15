using Microsoft.Extensions.Options;
using PetAssistant.Api.Data;
using PetAssistant.Api.DTOs;
using PetAssistant.Api.Models;
using PetAssistant.Api.Options;

namespace PetAssistant.Api.Services;

/// <summary>Orquesta sesiones, quick replies, memoria corta/larga, OpenAI y estado del avatar.</summary>
public class ConversationService : IConversationService
{
    private readonly InMemoryStore _store;
    private readonly IOpenAiService _openAi;
    private readonly IQuickReplyService _quickReply;
    private readonly IMemoryService _memory;
    private readonly IAvatarStateService _avatarState;
    private readonly AssistantOptions _assistant;

    public ConversationService(
        InMemoryStore store,
        IOpenAiService openAi,
        IQuickReplyService quickReply,
        IMemoryService memory,
        IAvatarStateService avatarState,
        IOptions<AssistantOptions> assistant)
    {
        _store = store;
        _openAi = openAi;
        _quickReply = quickReply;
        _memory = memory;
        _avatarState = avatarState;
        _assistant = assistant.Value;
    }

    public async Task<CreateSessionResponse> CreateSessionAsync(CreateSessionRequest request, CancellationToken ct = default)
    {
        try
        {
            var userId = request.UserId ?? Guid.Empty;
            var title = string.IsNullOrWhiteSpace(request.Title) ? "Conversación" : request.Title.Trim();
            var session = new ConversationSession
            {
                SessionId = Guid.NewGuid(),
                UserId = userId,
                Title = title,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            _store.AddSession(session);
            return await Task.FromResult(new CreateSessionResponse { SessionId = session.SessionId, Title = session.Title });
        }
        catch (Exception)
        {
            var fallback = new ConversationSession
            {
                SessionId = Guid.NewGuid(),
                UserId = request.UserId ?? Guid.Empty,
                Title = "Conversación",
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };
            _store.AddSession(fallback);
            return new CreateSessionResponse { SessionId = fallback.SessionId, Title = fallback.Title };
        }
    }

    public async Task<AssistantChatResponse> SendMessageAsync(AssistantChatRequest request, CancellationToken ct = default)
    {
        try
        {
            var userId = request.UserId ?? Guid.Empty;
            Guid sessionId;
            if (request.SessionId.HasValue && _store.GetSession(request.SessionId.Value) != null)
                sessionId = request.SessionId.Value;
            else
            {
                var create = await CreateSessionAsync(new CreateSessionRequest { UserId = userId, Title = "Chat" }, ct);
                sessionId = create.SessionId;
            }

            var avatarState = await _avatarState.GetOrCreateStateAsync(userId, ct);
            var shortMemory = await _memory.GetRecentConversationAsync(sessionId, 10, ct);
            var longMemory = _assistant.EnableLongMemory ? await _memory.GetUserMemoriesAsync(userId, ct) : new List<UserMemoryItem>();

            // Quick reply
            if (request.UseQuickReply && _assistant.EnableQuickReplies)
            {
                var qr = _quickReply.TryResolve(request.Message, _assistant.Name);
                if (qr.Matched && !string.IsNullOrEmpty(qr.Response))
                {
                    var userMsg = new ConversationMessage
                    {
                        Id = Guid.NewGuid(),
                        SessionId = sessionId,
                        Role = "user",
                        Content = request.Message,
                        CreatedAtUtc = DateTime.UtcNow,
                        IsQuickReply = false
                    };
                    var asstMsg = new ConversationMessage
                    {
                        Id = Guid.NewGuid(),
                        SessionId = sessionId,
                        Role = "assistant",
                        Content = qr.Response,
                        CreatedAtUtc = DateTime.UtcNow,
                        IsQuickReply = true,
                        Intent = qr.Intent
                    };
                    _store.AddMessage(userMsg);
                    _store.AddMessage(asstMsg);
                    await _avatarState.UpdateAfterInteractionAsync(userId, request.Message, qr.Response, ct);

                    var quickReplyAnimSelection = AvatarAnimationSelector.Select(request.Message, qr.SuggestedAnimation);
                    var cleanQr = (qr.Response ?? "").Trim();
                    return new AssistantChatResponse
                    {
                        SessionId = sessionId,
                        ReplyText = cleanQr,
                        Reply = cleanQr,
                        Mood = qr.Mood ?? "calm",
                        SuggestedAnimation = quickReplyAnimSelection.Animation,
                        SuggestedVoiceTone = qr.SuggestedVoiceTone ?? "warm",
                        UsedQuickReply = true,
                        SavedMemory = false,
                        MemoryHints = new List<string>(),
                        FollowUpSuggestions = new List<string> { "¿Qué más puedo hacer por ti?", "¿Quieres que recuerde algo?" }
                    };
                }
            }

            // System prompt con contexto temporal (fecha, hora, timezone)
            var systemPrompt = BuildSystemPrompt(avatarState, longMemory);

            // Llamar OpenAI
            var rawReply = await _openAi.GetAssistantReplyAsync(systemPrompt, request.Message, shortMemory, ct);

            // Parsear: texto limpio para usuario/TTS y metadatos separados
            var parsed = AssistantReplyParser.Parse(rawReply);
            var replyText = string.IsNullOrWhiteSpace(parsed.ReplyText) ? rawReply.Trim() : parsed.ReplyText;

            var userMessage = new ConversationMessage
            {
                Id = Guid.NewGuid(),
                SessionId = sessionId,
                Role = "user",
                Content = request.Message,
                CreatedAtUtc = DateTime.UtcNow,
                IsQuickReply = false
            };
            var assistantMessage = new ConversationMessage
            {
                Id = Guid.NewGuid(),
                SessionId = sessionId,
                Role = "assistant",
                Content = replyText,
                CreatedAtUtc = DateTime.UtcNow,
                IsQuickReply = false
            };
            _store.AddMessage(userMessage);
            _store.AddMessage(assistantMessage);

            var memoryHints = new List<string>();
            if (request.SaveMemory && _assistant.EnableLongMemory && userId != Guid.Empty)
            {
                try
                {
                    var extract = await _openAi.ExtractMemoryAsync(userId, request.Message, replyText, ct);
                    if (extract.HasMemoryToSave && extract.Items.Count > 0)
                    {
                        await _memory.SaveMemoryItemsAsync(extract.Items, ct);
                        memoryHints = extract.Items.Select(i => $"{i.Category}: {i.Key}").ToList();
                    }
                }
                catch (Exception) { /* fallback: no memoria guardada */ }
            }

            var updatedAvatar = await _avatarState.UpdateAfterInteractionAsync(userId, request.Message, replyText, ct);

            var mood = parsed.Mood ?? updatedAvatar.Mood ?? "calm";
            var tone = parsed.SuggestedVoiceTone ?? updatedAvatar.SuggestedVoiceTone ?? "warm";
            var openAiAnimSelection = AvatarAnimationSelector.Select(request.Message, parsed.SuggestedAnimation);
            var anim = openAiAnimSelection.Animation;

            return new AssistantChatResponse
            {
                SessionId = sessionId,
                ReplyText = replyText,
                Reply = replyText,
                Mood = mood,
                SuggestedAnimation = anim,
                SuggestedVoiceTone = tone,
                UsedQuickReply = false,
                SavedMemory = memoryHints.Count > 0,
                MemoryHints = memoryHints,
                FollowUpSuggestions = new List<string> { "¿Algo más?", "¿Quieres que recuerde algo?" }
            };
        }
        catch (Exception)
        {
            var fallbackText = "Lo siento, algo falló. ¿Puedes intentar de nuevo?";
            return new AssistantChatResponse
            {
                SessionId = request.SessionId ?? Guid.NewGuid(),
                ReplyText = fallbackText,
                Reply = fallbackText,
                Mood = "calm",
                SuggestedAnimation = "idle",
                SuggestedVoiceTone = "warm",
                UsedQuickReply = false,
                SavedMemory = false,
                MemoryHints = new List<string>(),
                FollowUpSuggestions = new List<string>()
            };
        }
    }

    public async Task<List<ConversationMessage>> GetMessagesAsync(Guid sessionId, CancellationToken ct = default)
    {
        try
        {
            return await _memory.GetRecentConversationAsync(sessionId, 100, ct);
        }
        catch (Exception)
        {
            return new List<ConversationMessage>();
        }
    }

    private string BuildSystemPrompt(AvatarState avatarState, List<UserMemoryItem> longMemory)
    {
        try
        {
            var basePrompt = _assistant.SystemPrompt;
            if (string.IsNullOrWhiteSpace(basePrompt))
                basePrompt = "Eres un asistente virtual cálido, breve y conversacional. Responde de forma natural y concisa.";

            var now = DateTime.UtcNow;
            var tz = TimeZoneInfo.Local;
            var localNow = TimeZoneInfo.ConvertTimeFromUtc(now, tz);
            var currentDate = localNow.ToString("yyyy-MM-dd");
            var currentTime = localNow.ToString("HH:mm");
            var timezone = tz.Id;

            var sb = new System.Text.StringBuilder();
            sb.AppendLine(basePrompt);
            sb.AppendLine($"Tu nombre es {_assistant.Name}. Responde siempre de forma breve.");
            sb.AppendLine($"Contexto temporal actual: fecha={currentDate}, hora={currentTime}, zona horaria={timezone}. Usa este contexto si te preguntan por el día o la hora.");
            sb.AppendLine($"Estado actual del avatar: mood={avatarState.Mood}, energía={avatarState.Energy}. No incluyas en el texto emojis ni metadatos como (tono X) o (animación X); el sistema los extrae por separado.");
            if (longMemory.Count > 0)
            {
                sb.AppendLine("Contexto del usuario que recuerdas:");
                foreach (var m in longMemory.Take(15))
                    sb.AppendLine($"- {m.Category}: {m.Key} = {m.Value}");
            }
            sb.AppendLine("No des respuestas largas. Sé cercano pero conciso.");
            return sb.ToString();
        }
        catch (Exception)
        {
            var basePrompt = _assistant.SystemPrompt ?? "Eres un asistente virtual breve y conversacional.";
            return basePrompt + "\nResponde de forma breve y natural.";
        }
    }
}
