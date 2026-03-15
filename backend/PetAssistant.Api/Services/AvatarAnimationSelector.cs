namespace PetAssistant.Api.Services;

/// <summary>Selección de animación del avatar: reglas directas por mensaje del usuario o sugerencia OpenAI, lista cerrada válida.</summary>
public static class AvatarAnimationSelector
{
    private const string LogPrefix = "[AvatarAction]";

    /// <summary>Animaciones válidas (lista cerrada).</summary>
    public static readonly IReadOnlySet<string> ValidAnimations = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "idle", "wave", "yes", "no", "dance", "walking", "jump", "thumbsUp", "sitting", "standing", "punch"
    };

    /// <summary>Origen de la animación elegida.</summary>
    public enum Source { Rule, OpenAi, Fallback }

    /// <summary>Resultado de la selección.</summary>
    public sealed class SelectionResult
    {
        public string Animation { get; set; } = "idle";
        public Source Source { get; set; }
    }

    /// <summary>Elige animación: 1) reglas por texto del usuario, 2) sugerencia OpenAI si está en la lista, 3) idle. Nunca lanza.</summary>
    public static SelectionResult Select(string? userMessage, string? openAiSuggestedAnimation)
    {
        try
        {
            var msg = (userMessage ?? "").Trim().ToLowerInvariant();
            Console.WriteLine($"{LogPrefix} userText: {Truncate(msg, 80)}");

            // 1) Reglas directas (orden: frases más específicas primero)
            var ruleAnim = TryMatchRule(msg);
            if (!string.IsNullOrEmpty(ruleAnim))
            {
                var anim = Normalize(ruleAnim);
                Console.WriteLine($"{LogPrefix} chosen animation: {anim}");
                Console.WriteLine($"{LogPrefix} source: rule");
                return new SelectionResult { Animation = anim, Source = Source.Rule };
            }

            // 2) Sugerencia de OpenAI si está en la lista cerrada
            if (!string.IsNullOrWhiteSpace(openAiSuggestedAnimation))
            {
                var normalized = Normalize(openAiSuggestedAnimation.Trim());
                if (ValidAnimations.Contains(normalized))
                {
                    Console.WriteLine($"{LogPrefix} chosen animation: {normalized}");
                    Console.WriteLine($"{LogPrefix} source: openai");
                    return new SelectionResult { Animation = normalized, Source = Source.OpenAi };
                }
            }

            // 3) Fallback
            Console.WriteLine($"{LogPrefix} chosen animation: idle");
            Console.WriteLine($"{LogPrefix} source: fallback");
            return new SelectionResult { Animation = "idle", Source = Source.Fallback };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"{LogPrefix} Select error: {ex.Message}");
            return new SelectionResult { Animation = "idle", Source = Source.Fallback };
        }
    }

    private static string? TryMatchRule(string msg)
    {
        if (string.IsNullOrWhiteSpace(msg)) return null;

        // Baila / dance
        if (ContainsWord(msg, "baila", "bailes", "baile", "dance", "quiero que bailes", "que bailes")) return "dance";
        // Camina / walking
        if (ContainsWord(msg, "camina", "camines", "walking", "walk", "caminar")) return "walking";
        // Salta / jump
        if (ContainsWord(msg, "salta", "saltes", "jump", "saltar", "salte")) return "jump";
        // Di que sí / yes
        if (ContainsWord(msg, "di que sí", "di que si", "que digas sí", "que digas si")) return "yes";
        if (msg == "sí" || msg == "si" || msg == "yes") return "yes";
        // Di que no / no
        if (ContainsWord(msg, "di que no", "que digas no")) return "no";
        if (msg == "no") return "no";
        // Hola / saluda / wave
        if (ContainsWord(msg, "hola", "saluda", "saludar", "salúdame", "saludame", "di hola", "wave")) return "wave";
        // Thumbs up (opcional)
        if (ContainsWord(msg, "pulgar", "thumbs", "genial bien")) return "thumbsUp";
        // Sentado / de pie
        if (ContainsWord(msg, "siéntate", "sientate", "sentado", "sitting", "sit")) return "sitting";
        if (ContainsWord(msg, "levántate", "levantate", "de pie", "standing", "stand")) return "standing";
        // Punch (golpe)
        if (ContainsWord(msg, "golpea", "punch", "puño")) return "punch";

        return null;
    }

    private static bool ContainsWord(string message, params string[] words)
    {
        foreach (var w in words)
        {
            if (message.Contains(w, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    /// <summary>Normaliza a una animación de la lista cerrada; si no está, devuelve idle.</summary>
    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "idle";
        var v = value.Trim().ToLowerInvariant();
        if (ValidAnimations.Contains(v)) return v;
        if (v == "walk") return "walking";
        if (v == "celebrate") return "dance";
        return "idle";
    }

    private static string Truncate(string s, int maxLen)
    {
        if (string.IsNullOrEmpty(s)) return "";
        return s.Length <= maxLen ? s : s.Substring(0, maxLen) + "...";
    }
}
