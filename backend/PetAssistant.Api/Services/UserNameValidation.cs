namespace PetAssistant.Api.Services;

/// <summary>Valida que un valor no sea un comando/orden usado por error como nombre del usuario.</summary>
public static class UserNameValidation
{
    /// <summary>Palabras que nunca deben guardarse ni usarse como nombre del usuario (comandos, saludos, etc.).</summary>
    public static readonly HashSet<string> BlockedWordsForUserName = new(StringComparer.OrdinalIgnoreCase)
    {
        "brinca", "baila", "camina", "siéntate", "sientate", "párate", "parate", "salta",
        "hola", "adiós", "adios", "sí", "si", "no"
    };

    /// <summary>Indica si el valor es un nombre válido (no es comando/saludo bloqueado).</summary>
    public static bool IsValidUserName(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        var v = value.Trim().ToLowerInvariant();
        return !BlockedWordsForUserName.Contains(v);
    }

    /// <summary>Indica si el ítem de memoria parece ser "nombre del usuario" (para filtrar valores bloqueados).</summary>
    public static bool IsNameLikeMemoryItem(string? category, string? key)
    {
        var c = (category ?? "").Trim().ToLowerInvariant();
        var k = (key ?? "").Trim().ToLowerInvariant();
        return c == "nombre" || c == "name" || c == "profile" && (k == "nombre" || k == "name" || k == "user_name");
    }
}
