namespace PetAssistant.Api.DTOs;

/// <summary>Respuesta estándar de la API para nuevos endpoints. Los existentes (auth, user, assistant) no se cambian.</summary>
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }
    public string? ErrorCode { get; set; }

    public static ApiResponse<T> Ok(T data, string message = "OK") => new()
    {
        Success = true,
        Message = message,
        Data = data
    };

    public static ApiResponse<T> Fail(string message, string? errorCode = null) => new()
    {
        Success = false,
        Message = message,
        ErrorCode = errorCode
    };
}
