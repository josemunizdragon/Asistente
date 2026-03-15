using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PetAssistant.Api.DTOs;
using PetAssistant.Api.Models;
using PetAssistant.Api.Options;

namespace PetAssistant.Api.Services;

/// <summary>Implementación de OpenAI con fallback y modo mock. Try/catch en todos los puntos sensibles.</summary>
public class OpenAiService : IOpenAiService
{
    private const string LogPrefix = "[OpenAI]";

    private readonly HttpClient _httpClient;
    private readonly OpenAiOptions _openAi;
    private readonly AssistantOptions _assistant;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public OpenAiService(HttpClient httpClient, IOptions<OpenAiOptions> openAi, IOptions<AssistantOptions> assistant)
    {
        _httpClient = httpClient;
        _openAi = openAi?.Value ?? throw new ArgumentNullException(nameof(openAi));
        _assistant = assistant?.Value ?? throw new ArgumentNullException(nameof(assistant));
        _httpClient.Timeout = TimeSpan.FromSeconds(30);
        var keyLen = _openAi.ApiKey?.Length ?? 0;
        Console.WriteLine($"{LogPrefix} ApiKey configured: {keyLen > 0} (length: {keyLen})");
    }

    public async Task<string> GetAssistantReplyAsync(string systemPrompt, string userMessage, List<ConversationMessage> shortMemory, CancellationToken ct = default)
    {
        if (_assistant.UseMockOpenAI)
        {
            var mockReply = GetMockReply(userMessage);
            Console.WriteLine($"{LogPrefix} reply source: mock");
            return mockReply;
        }

        if (string.IsNullOrWhiteSpace(_openAi.ApiKey))
        {
            Console.WriteLine($"{LogPrefix} reply source: fallback (ApiKey empty)");
            return GetFallbackReply();
        }

        try
        {
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
            if (!req.Headers.TryAddWithoutValidation("Authorization", "Bearer " + _openAi.ApiKey.Trim()))
            {
                Console.WriteLine($"{LogPrefix} reply source: fallback (failed to set Authorization header)");
                return GetFallbackReply();
            }

            HttpResponseMessage response;
            try
            {
                response = await _httpClient.SendAsync(req, ct);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"{LogPrefix} reply source: fallback (HTTP error: {ex.Message})");
                return GetFallbackReply();
            }

            if (!response.IsSuccessStatusCode)
            {
                var errBody = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
                Console.WriteLine($"{LogPrefix} reply source: fallback (HTTP {(int)response.StatusCode}) {errBody?.Length ?? 0} chars");
                if (!string.IsNullOrWhiteSpace(errBody) && errBody.Length < 500)
                    Console.WriteLine($"{LogPrefix} OpenAI error body: {errBody}");
                return GetFallbackReply();
            }

            string json;
            try
            {
                json = await response.Content.ReadAsStringAsync(ct);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"{LogPrefix} reply source: fallback (read body: {ex.Message})");
                return GetFallbackReply();
            }

            string? content;
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                if (!root.TryGetProperty("choices", out var choices) || choices.GetArrayLength() == 0)
                {
                    Console.WriteLine($"{LogPrefix} reply source: fallback (no choices in response)");
                    return GetFallbackReply();
                }
                var choice = choices[0];
                if (!choice.TryGetProperty("message", out var message) || !message.TryGetProperty("content", out var contentEl))
                {
                    Console.WriteLine($"{LogPrefix} reply source: fallback (message/content missing)");
                    return GetFallbackReply();
                }
                content = contentEl.GetString();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"{LogPrefix} reply source: fallback (parse error: {ex.Message})");
                return GetFallbackReply();
            }

            if (string.IsNullOrWhiteSpace(content))
            {
                Console.WriteLine($"{LogPrefix} reply source: fallback (empty content)");
                return GetFallbackReply();
            }

            Console.WriteLine($"{LogPrefix} reply source: openai");
            return content.Trim();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"{LogPrefix} reply source: fallback (exception: {ex.Message})");
            return GetFallbackReply();
        }
    }

    public async Task<MemoryExtractResult> ExtractMemoryAsync(Guid userId, string userMessage, string assistantReply, CancellationToken ct = default)
    {
        var empty = new MemoryExtractResult { HasMemoryToSave = false, Items = new List<UserMemoryItem>() };

        if (_assistant.UseMockOpenAI)
        {
            Console.WriteLine($"{LogPrefix} memory source: mock (skipped)");
            return await Task.FromResult(empty);
        }

        if (string.IsNullOrWhiteSpace(_openAi.ApiKey))
        {
            Console.WriteLine($"{LogPrefix} memory source: fallback (ApiKey empty)");
            return empty;
        }

        try
        {
            var system = "Extrae de la conversación datos personales del usuario que valga la pena recordar: preferencias, fechas importantes, nombres, relaciones. Devuelve JSON con array 'items': cada uno { category, key, value, importance (0-1) }. Si no hay nada que guardar, devuelve { \"items\": [] }.";
            var content = $"Usuario: {userMessage}\nAsistente: {assistantReply}";
            var messages = new[] { new { role = "system", content = system }, new { role = "user", content = content } };
            var payload = new { model = _openAi.Model, messages };
            var req = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions")
            {
                Content = JsonContent.Create(payload, options: JsonOptions)
            };
            if (!req.Headers.TryAddWithoutValidation("Authorization", "Bearer " + _openAi.ApiKey.Trim()))
            {
                Console.WriteLine($"{LogPrefix} memory source: fallback (failed to set Authorization header)");
                return empty;
            }

            HttpResponseMessage response;
            try
            {
                response = await _httpClient.SendAsync(req, ct);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"{LogPrefix} memory source: fallback (HTTP error: {ex.Message})");
                return empty;
            }

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"{LogPrefix} memory source: fallback (HTTP {(int)response.StatusCode})");
                return empty;
            }

            string json;
            try
            {
                json = await response.Content.ReadAsStringAsync(ct);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"{LogPrefix} memory source: fallback (read body: {ex.Message})");
                return empty;
            }

            string? text;
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                if (!root.TryGetProperty("choices", out var choices) || choices.GetArrayLength() == 0)
                {
                    Console.WriteLine($"{LogPrefix} memory source: fallback (no choices)");
                    return empty;
                }
                text = choices[0].GetProperty("message").GetProperty("content").GetString();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"{LogPrefix} memory source: fallback (parse error: {ex.Message})");
                return empty;
            }

            if (string.IsNullOrWhiteSpace(text))
            {
                Console.WriteLine($"{LogPrefix} memory source: openai (empty items)");
                return empty;
            }

            var items = new List<UserMemoryItem>();
            var start = text.IndexOf('[');
            if (start >= 0)
            {
                try
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
                catch (Exception ex)
                {
                    Console.WriteLine($"{LogPrefix} memory source: fallback (parse items: {ex.Message})");
                    return empty;
                }
            }

            Console.WriteLine($"{LogPrefix} memory source: openai (items: {items.Count})");
            return new MemoryExtractResult { HasMemoryToSave = items.Count > 0, Items = items };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"{LogPrefix} memory source: fallback (exception: {ex.Message})");
            return empty;
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
