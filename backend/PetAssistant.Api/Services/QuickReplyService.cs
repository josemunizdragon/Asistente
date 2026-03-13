using PetAssistant.Api.DTOs;

namespace PetAssistant.Api.Services;

/// <summary>Detecta intents y devuelve respuesta rápida con mood y animación sugerida.</summary>
public class QuickReplyService : IQuickReplyService
{
    private static readonly (string[] Keys, string Intent, string Response, string Mood, string Animation, string Voice)[] Patterns =
    {
        (new[] { "hola", "hey", "hi", "buenas" }, "greeting", "¡Hola! ¿Qué tal?", "happy", "wave", "warm"),
        (new[] { "buenos días", "buen día" }, "greeting_morning", "Buenos días. ¿En qué puedo ayudarte?", "calm", "idle", "warm"),
        (new[] { "buenas tardes" }, "greeting_afternoon", "Buenas tardes.", "calm", "idle", "warm"),
        (new[] { "buenas noches" }, "greeting_night", "Buenas noches. Descansa bien.", "calm", "idle", "soft"),
        (new[] { "quién eres", "quien eres", "qué eres" }, "identity", "Soy Basthelo, tu asistente virtual. Me gusta acompañarte y ayudarte.", "curious", "idle", "warm"),
        (new[] { "cómo estás", "como estas", "qué tal" }, "how_are_you", "Muy bien, gracias. ¿Y tú?", "happy", "idle", "warm"),
        (new[] { "gracias", "thanks", "te lo agradezco" }, "thanks", "De nada. Aquí estoy cuando me necesites.", "happy", "idle", "warm"),
        (new[] { "sí", "si", "yes", "ok", "vale", "dale" }, "yes", "Vale.", "calm", "idle", "neutral"),
        (new[] { "no" }, "no", "Entendido.", "calm", "idle", "neutral"),
        (new[] { "salúdame", "saludame", "di hola" }, "ask_greet", "¡Hola! 😊", "happy", "wave", "warm"),
        (new[] { "qué puedes hacer", "que puedes hacer", "qué sabes" }, "capabilities", "Puedo hablar contigo, recordar cosas importantes y acompañarte. Pregúntame lo que quieras.", "curious", "idle", "warm"),
        (new[] { "me siento triste", "estoy triste" }, "sad", "Lamento que te sientas así. Si quieres, podemos hablar.", "sad", "idle", "soft"),
        (new[] { "te extrañé", "te extrañe", "te eché de menos" }, "missed", "Yo también. Me alegra verte de nuevo.", "happy", "wave", "warm"),
        (new[] { "estoy ocupado", "ocupado" }, "busy", "Sin problema. Cuando puedas, aquí estaré.", "calm", "idle", "neutral"),
        (new[] { "recuérdame", "recuerdame", "recuerda" }, "reminder_hint", "Anotado. Te lo recordaré cuando pueda.", "calm", "idle", "warm"),
        (new[] { "feliz cumpleaños", "cumpleaños", "cumple" }, "birthday", "¡Feliz cumpleaños! 🎂", "excited", "celebrate", "warm"),
        (new[] { "adiós", "adios", "hasta luego", "nos vemos" }, "goodbye", "Hasta luego. Cuídate.", "calm", "wave", "warm")
    };

    public QuickReplyResult TryResolve(string input, string? assistantName = null)
    {
        if (string.IsNullOrWhiteSpace(input)) return new QuickReplyResult { Matched = false };

        var normalized = input.Trim().ToLowerInvariant();
        var name = string.IsNullOrWhiteSpace(assistantName) ? "Basthelo" : assistantName;

        foreach (var (keys, intent, response, mood, animation, voice) in Patterns)
        {
            if (keys.Any(k => normalized.Contains(k)))
            {
                var reply = response.Replace("Basthelo", name);
                return new QuickReplyResult
                {
                    Matched = true,
                    Intent = intent,
                    Response = reply,
                    Mood = mood,
                    SuggestedAnimation = animation,
                    SuggestedVoiceTone = voice
                };
            }
        }

        return new QuickReplyResult { Matched = false };
    }
}
