using System.Text.RegularExpressions;

namespace PetAssistant.Api.Services;

/// <summary>Parsea la respuesta cruda del modelo: extrae texto limpio y metadatos (animación, tono, mood).</summary>
public static class AssistantReplyParser
{
    private const string LogPrefix = "[AssistantParser]";

    /// <summary>Resultado del parseo: texto para usuario/TTS y metadatos opcionales.</summary>
    public sealed class ParsedReply
    {
        public string ReplyText { get; set; } = string.Empty;
        public string? Mood { get; set; }
        public string? SuggestedAnimation { get; set; }
        public string? SuggestedVoiceTone { get; set; }
    }

    /// <summary>Parsea la salida cruda del modelo y devuelve texto limpio + metadatos. Nunca lanza.</summary>
    public static ParsedReply Parse(string? raw)
    {
        var result = new ParsedReply { Mood = null, SuggestedAnimation = null, SuggestedVoiceTone = null };
        if (string.IsNullOrWhiteSpace(raw))
        {
            result.ReplyText = string.Empty;
            return result;
        }

        try
        {
            Console.WriteLine($"{LogPrefix} raw model output: {Truncate(raw, 200)}");

            var text = raw.Trim();

            // Extraer (animación X) o (animación X)
            var animMatch = Regex.Match(text, @"\(animación\s+(\w+)\)", RegexOptions.IgnoreCase);
            if (animMatch.Success)
            {
                result.SuggestedAnimation = animMatch.Groups[1].Value.ToLowerInvariant();
                text = Regex.Replace(text, @"\(animación\s+\w+\)", "", RegexOptions.IgnoreCase);
            }

            // Extraer (tono X)
            var toneMatch = Regex.Match(text, @"\(tono\s+(\w+)\)", RegexOptions.IgnoreCase);
            if (toneMatch.Success)
            {
                result.SuggestedVoiceTone = toneMatch.Groups[1].Value.ToLowerInvariant();
                text = Regex.Replace(text, @"\(tono\s+\w+\)", "", RegexOptions.IgnoreCase);
            }

            // Eliminar otros patrones entre paréntesis que parezcan metadatos: (idle), (wave), (warm), etc.
            text = Regex.Replace(text, @"\(\s*(idle|wave|celebrate|warm|soft|neutral)\s*\)", "", RegexOptions.IgnoreCase);

            // Eliminar bloques tipo "idle, tono warm" o "idle, warm" al final
            text = Regex.Replace(text, @"[,\s]*(idle|wave|celebrate|warm|soft|neutral)(\s*,\s*(idle|wave|celebrate|warm|soft|neutral))*\s*$", "", RegexOptions.IgnoreCase);

            // Eliminar emojis (rangos Unicode comunes)
            text = Regex.Replace(text, @"[\u2600-\u26FF\u2700-\u27BF\U0001F300-\U0001F9FF]", "");

            text = text.Trim();
            text = Regex.Replace(text, @"\s+", " ");
            text = text.Trim(',', ' ', '\n', '\r');
            if (string.IsNullOrWhiteSpace(text))
                text = raw.Trim();

            result.ReplyText = text;

            Console.WriteLine($"{LogPrefix} parsed replyText: {Truncate(result.ReplyText, 120)}");
            Console.WriteLine($"{LogPrefix} parsed animation: {result.SuggestedAnimation ?? "(null)"}");
            Console.WriteLine($"{LogPrefix} parsed tone: {result.SuggestedVoiceTone ?? "(null)"}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"{LogPrefix} parse error (using raw as replyText): {ex.Message}");
            result.ReplyText = raw.Trim();
        }

        return result;
    }

    private static string Truncate(string s, int maxLen)
    {
        if (string.IsNullOrEmpty(s)) return "";
        return s.Length <= maxLen ? s : s.Substring(0, maxLen) + "...";
    }
}
