using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PetAssistant.Api.DTOs;
using PetAssistant.Api.Models;
using PetAssistant.Api.Options;

namespace PetAssistant.Api.Services;

/// <summary>Implementación de OpenAI con fallback y modo mock. Try/catch en todos los puntos sensibles.</summary>
public class OpenAiService : IOpenAiService
{
    private readonly HttpClient _httpClient;
    private readonly OpenAiOptions _openAi;
    private readonly AssistantOptions _assistant;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public OpenAiService(HttpClient httpClient, IOptions<OpenAiOptions> openAi, IOptions<AssistantOptions> assistant)
    {
        _httpClient = httpClient;
        _openAi = openAi.Value;
        _assistant = assistant.Value;
        _httpClient.Timeout = TimeSpan.FromSeconds(30);
    }

    public async Task<string> GetAssistantReplyAsync(string systemPrompt, string userMessage, List<ConversationMessage> shortMemory, CancellationToken ct = default)
    {
        if (_assistant.UseMockOpenAI)
            return GetMockReply(userMessage);

        try
        {
            if (string.IsNullOrWhiteSpace(_openAi.ApiKey))
                return GetFallbackReply();

            var messages = new List<object>
            {
                new { role = "system", content = systemPrompt }
            };
            foreach (var m in shortMemory.TakeLast(20))
                messages.Add(new { role = m.Role, content = m.Content });
            messages.Add(new { role = "user", content = userMessage });

            var payload = new { model = _openAi.FastModel, messages };
            var req = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions")
            {
                Content = JsonContent.Create(payload, options: JsonOptions)
            };
            req.Headers.Add("Authorization", "Bearer " + _openAi.ApiKey);

            var response = await _httpClient.SendAsync(req, ct);
            if (!response.IsSuccessStatusCode)
                return GetFallbackReply();

            var json = await response.Content.ReadAsStringAsync(ct);
            var doc = JsonDocument.Parse(json);
            var choice = doc.RootElement.GetProperty("choices")[0];
            var content = choice.GetProperty("message").GetProperty("content").GetString();
            return string.IsNullOrWhiteSpace(content) ? GetFallbackReply() : content.Trim();
        }
        catch (Exception)
        {
            return GetFallbackReply();
        }
    }

    public async Task<MemoryExtractResult> ExtractMemoryAsync(Guid userId, string userMessage, string assistantReply, CancellationToken ct = default)
    {
        if (_assistant.UseMockOpenAI)
            return await Task.FromResult(new MemoryExtractResult { HasMemoryToSave = false, Items = new List<UserMemoryItem>() });

        try
        {
            if (string.IsNullOrWhiteSpace(_openAi.ApiKey))
                return new MemoryExtractResult { HasMemoryToSave = false, Items = new List<UserMemoryItem>() };

            var system = "Extrae de la conversación datos personales del usuario que valga la pena recordar: preferencias, fechas importantes, nombres, relaciones. Devuelve JSON con array 'items': cada uno { category, key, value, importance (0-1) }. Si no hay nada que guardar, devuelve { \"items\": [] }.";
            var content = $"Usuario: {userMessage}\nAsistente: {assistantReply}";
            var messages = new[] { new { role = "system", content = system }, new { role = "user", content = content } };
            var payload = new { model = _openAi.Model, messages };
            var req = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions")
            {
                Content = JsonContent.Create(payload, options: JsonOptions)
            };
            req.Headers.Add("Authorization", "Bearer " + _openAi.ApiKey);

            var response = await _httpClient.SendAsync(req, ct);
            if (!response.IsSuccessStatusCode)
                return new MemoryExtractResult { HasMemoryToSave = false, Items = new List<UserMemoryItem>() };

            var json = await response.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            var text = doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();
            if (string.IsNullOrWhiteSpace(text)) return new MemoryExtractResult { HasMemoryToSave = false, Items = new List<UserMemoryItem>() };

            var items = new List<UserMemoryItem>();
            var start = text.IndexOf('[');
            if (start >= 0)
            {
                var end = text.LastIndexOf(']') + 1;
                if (end > start)
                {
                    var jsonArray = text.Substring(start, end - start);
                    using var docArr = JsonDocument.Parse(jsonArray);
                    var arr = docArr.RootElement;
                    foreach (var e in arr.EnumerateArray())
                    {
                        items.Add(new UserMemoryItem
                        {
                            Id = Guid.NewGuid(),
                            UserId = userId,
                            Category = e.TryGetProperty("category", out var c) ? c.GetString() ?? "preference" : "preference",
                            Key = e.TryGetProperty("key", out var k) ? k.GetString() ?? "" : "",
                            Value = e.TryGetProperty("value", out var v) ? v.GetString() ?? "" : "",
                            Importance = e.TryGetProperty("importance", out var i) ? i.GetDouble() : 0.5,
                            CreatedAtUtc = DateTime.UtcNow,
                            UpdatedAtUtc = DateTime.UtcNow
                        });
                    }
                }
            }
            return new MemoryExtractResult { HasMemoryToSave = items.Count > 0, Items = items };
        }
        catch (Exception)
        {
            return new MemoryExtractResult { HasMemoryToSave = false, Items = new List<UserMemoryItem>() };
        }
    }

    private static string GetMockReply(string userMessage)
    {
        var lower = (userMessage ?? "").Trim().ToLowerInvariant();
        if (lower.Contains("hola") || lower.Contains("hey")) return "¡Hola! ¿En qué puedo ayudarte?";
        if (lower.Contains("gracias")) return "De nada. Aquí estoy cuando me necesites.";
        if (lower.Contains("quién eres")) return "Soy Basthelo, tu asistente virtual. Me gusta ser cercano y útil.";
        if (lower.Contains("cómo estás")) return "Muy bien, gracias. ¿Y tú?";
        if (lower.Contains("triste")) return "Lamento que te sientas así. Si quieres, podemos hablar un poco.";
        return "Entendido. ¿Hay algo más en lo que pueda ayudarte?";
    }

    private static string GetFallbackReply() =>
        "Lo siento, no pude procesar tu mensaje ahora. ¿Puedes intentar de nuevo en un momento?";
}
