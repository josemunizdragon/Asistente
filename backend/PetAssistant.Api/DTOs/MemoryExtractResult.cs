using PetAssistant.Api.Models;

namespace PetAssistant.Api.DTOs;

/// <summary>Resultado de extracción de memorias desde una conversación.</summary>
public class MemoryExtractResult
{
    public bool HasMemoryToSave { get; set; }
    public List<UserMemoryItem> Items { get; set; } = new();
}
