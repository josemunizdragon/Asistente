using System.Collections.Concurrent;
using PetAssistant.Api.Models;

namespace PetAssistant.Api.Data;

/// <summary>Persistencia en memoria thread-safe. Preparado para sustituir por EF/SQL sin tocar controllers.</summary>
public class InMemoryStore
{
    private readonly ConcurrentDictionary<Guid, ConversationSession> _sessions = new();
    private readonly ConcurrentDictionary<Guid, List<ConversationMessage>> _messagesBySession = new();
    private readonly ConcurrentDictionary<Guid, List<UserMemoryItem>> _memoriesByUser = new();
    private readonly ConcurrentDictionary<Guid, AvatarState> _avatarStateByUser = new();

    // Sessions
    public void AddSession(ConversationSession session)
    {
        _sessions[session.SessionId] = session;
        _messagesBySession[session.SessionId] = new List<ConversationMessage>();
    }

    public ConversationSession? GetSession(Guid sessionId) =>
        _sessions.TryGetValue(sessionId, out var s) ? s : null;

    public List<ConversationSession> GetSessionsByUser(Guid userId) =>
        _sessions.Values.Where(s => s.UserId == userId).OrderByDescending(s => s.UpdatedAtUtc).ToList();

    // Messages
    public void AddMessage(ConversationMessage message)
    {
        var list = _messagesBySession.GetOrAdd(message.SessionId, _ => new List<ConversationMessage>());
        lock (list) list.Add(message);
        if (_sessions.TryGetValue(message.SessionId, out var session))
        {
            session.UpdatedAtUtc = DateTime.UtcNow;
        }
    }

    public List<ConversationMessage> GetMessages(Guid sessionId, int? max = null)
    {
        if (!_messagesBySession.TryGetValue(sessionId, out var list)) return new List<ConversationMessage>();
        lock (list)
        {
            var ordered = list.OrderBy(m => m.CreatedAtUtc).ToList();
            return max.HasValue ? ordered.TakeLast(max.Value).ToList() : ordered;
        }
    }

    // Memories
    public void AddOrUpdateMemory(UserMemoryItem item)
    {
        var list = _memoriesByUser.GetOrAdd(item.UserId, _ => new List<UserMemoryItem>());
        lock (list)
        {
            var existing = list.FirstOrDefault(m => m.Key == item.Key && m.Category == item.Category);
            if (existing != null)
            {
                existing.Value = item.Value;
                existing.Importance = item.Importance;
                existing.UpdatedAtUtc = DateTime.UtcNow;
            }
            else
            {
                list.Add(item);
            }
        }
    }

    public void AddMemories(IEnumerable<UserMemoryItem> items)
    {
        foreach (var item in items) AddOrUpdateMemory(item);
    }

    public List<UserMemoryItem> GetMemories(Guid userId) =>
        _memoriesByUser.TryGetValue(userId, out var list) ? new List<UserMemoryItem>(list) : new List<UserMemoryItem>();

    // Avatar state
    public void SetAvatarState(AvatarState state) => _avatarStateByUser[state.UserId] = state;

    public AvatarState? GetAvatarState(Guid userId) =>
        _avatarStateByUser.TryGetValue(userId, out var s) ? s : null;
}
