# Fase 1 Backend Conversacional — Entrega

## 1. Árbol de archivos nuevos y modificados

### Nuevos
```
Options/OpenAiOptions.cs
Options/AssistantOptions.cs
DTOs/ApiResponse.cs
DTOs/AssistantChatRequest.cs
DTOs/AssistantChatResponse.cs
DTOs/CreateSessionRequest.cs
DTOs/CreateSessionResponse.cs
DTOs/QuickReplyResult.cs
DTOs/MemoryExtractResult.cs
DTOs/UserContextResponse.cs
DTOs/HealthDetailsResponse.cs
Models/ConversationSession.cs
Models/ConversationMessage.cs
Models/UserMemoryItem.cs
Models/AvatarState.cs
Data/InMemoryStore.cs
Services/IOpenAiService.cs
Services/OpenAiService.cs
Services/IQuickReplyService.cs
Services/QuickReplyService.cs
Services/IMemoryService.cs
Services/MemoryService.cs
Services/IAvatarStateService.cs
Services/AvatarStateService.cs
Services/IConversationService.cs
Services/ConversationService.cs
Controllers/ConversationController.cs
Controllers/MemoryController.cs
Controllers/AvatarController.cs
```

### Modificados
```
Program.cs
appsettings.json
Controllers/HealthController.cs  (añadido GET details)
```

### Sin tocar (existentes)
```
Controllers/AuthController.cs
Controllers/UserController.cs
Controllers/AssistantController.cs
Services/AuthService.cs, IAuthService.cs
Services/UserService.cs, IUserService.cs
Services/AssistantService.cs, IAssistantService.cs
DTOs/LoginRequest.cs, LoginResponse.cs, SignupRequest.cs, SignupResponse.cs
DTOs/UserProfileResponse.cs, WelcomeResponse.cs, HealthResponse.cs
Models/User.cs
```

---

## 2. Program.cs (completo)

Ver archivo `Program.cs` en la raíz del proyecto.

---

## 3. Controllers (resumen)

- **ConversationController** (`api/conversation`)
  - `POST session/create` → ApiResponse<CreateSessionResponse>
  - `POST message` → ApiResponse<AssistantChatResponse>
  - `GET {sessionId}/messages` → ApiResponse<List<ConversationMessageDto>>

- **MemoryController** (`api/memory`)
  - `GET {userId}` → ApiResponse<List<UserMemoryItemDto>>
  - `GET {userId}/context` → ApiResponse<UserContextResponse>

- **AvatarController** (`api/avatar`)
  - `GET {userId}/state` → ApiResponse<AvatarStateDto>

- **HealthController** (`api/health`)
  - `GET` → HealthResponse (sin cambio)
  - `GET details` → HealthDetailsResponse

---

## 4. Servicios (resumen)

- **OpenAiService**: GetAssistantReplyAsync, ExtractMemoryAsync (mock si UseMockOpenAI).
- **QuickReplyService**: TryResolve (intents: greeting, thanks, yes/no, etc.).
- **MemoryService**: SaveMemoryItemsAsync, GetUserMemoriesAsync, GetRecentConversationAsync.
- **AvatarStateService**: GetOrCreateStateAsync, UpdateAfterInteractionAsync.
- **ConversationService**: CreateSessionAsync, SendMessageAsync (orquesta quick reply, memoria, OpenAI), GetMessagesAsync.

---

## 5. DTOs y modelos nuevos

Ver carpetas `DTOs/`, `Models/`, `Options/`.

---

## 6. Ejemplos para probar en Swagger

### POST /api/conversation/session/create
**Request:**
```json
{
  "userId": "00000000-0000-0000-0000-000000000001",
  "title": "Mi primera conversación"
}
```
**Response (200):**
```json
{
  "success": true,
  "message": "Sesión creada",
  "data": {
    "sessionId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "title": "Mi primera conversación"
  },
  "errorCode": null
}
```

### POST /api/conversation/message
**Request:**
```json
{
  "userId": "00000000-0000-0000-0000-000000000001",
  "sessionId": null,
  "message": "Hola, ¿quién eres?",
  "useQuickReply": true,
  "saveMemory": true,
  "returnVoiceHints": true
}
```
**Response (200) con quick reply:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "sessionId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "reply": "Soy Basthelo, tu asistente virtual. Me gusta ser cercano y útil.",
    "mood": "curious",
    "suggestedAnimation": "idle",
    "suggestedVoiceTone": "warm",
    "usedQuickReply": true,
    "savedMemory": false,
    "memoryHints": [],
    "followUpSuggestions": ["¿Qué más puedo hacer por ti?", "¿Quieres que recuerde algo?"]
  },
  "errorCode": null
}
```

### GET /api/health/details
**Response (200):**
```json
{
  "status": "Healthy",
  "timestamp": "2025-03-12T00:00:00Z",
  "openAiConfigured": false,
  "useMockOpenAi": true,
  "quickRepliesEnabled": true,
  "longMemoryEnabled": true
}
```

### GET /api/avatar/{userId}/state
**Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "userId": "00000000-0000-0000-0000-000000000001",
    "mood": "calm",
    "energy": "medium",
    "attachmentLevel": "medium",
    "lastInteractionAtUtc": "2025-03-12T00:00:00Z",
    "consecutiveDaysActive": 1,
    "currentNeed": null,
    "suggestedAnimation": "idle",
    "suggestedVoiceTone": "warm"
  },
  "errorCode": null
}
```

### GET /api/memory/{userId}/context
**Response (200):**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "userId": "00000000-0000-0000-0000-000000000001",
    "longMemory": [],
    "avatarState": { ... },
    "sessionCount": 1,
    "messageCount": 2
  },
  "errorCode": null
}
```

---

## Endpoints existentes (no modificados)

- `POST /api/auth/login`
- `POST /api/auth/signup`
- `GET /api/user/profile`
- `GET /api/assistant/welcome`
- `GET /api/health`
