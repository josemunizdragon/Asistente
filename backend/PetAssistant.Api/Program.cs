using PetAssistant.Api.Data;
using PetAssistant.Api.Options;
using PetAssistant.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Configuración tipada (OpenAI, Assistant)
builder.Services.Configure<OpenAiOptions>(builder.Configuration.GetSection(OpenAiOptions.SectionName));
builder.Services.Configure<AssistantOptions>(builder.Configuration.GetSection(AssistantOptions.SectionName));

// Memoria en caché (para futura caché de respuestas, sesiones, etc.)
builder.Services.AddMemoryCache();

// Servicios
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS abierto para desarrollo
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// HttpClient para OpenAI (base address no necesario; se usa absoluto en el servicio)
builder.Services.AddHttpClient<IOpenAiService, OpenAiService>();

// Persistencia en memoria (sustituible por EF/repositorios sin tocar controllers)
builder.Services.AddSingleton<InMemoryStore>();

// Inyección de dependencias - existentes (no eliminar)
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IAssistantService, AssistantService>();

// Inyección de dependencias - Fase 1 conversacional (OpenAiService recibe HttpClient vía AddHttpClient)
builder.Services.AddScoped<IQuickReplyService, QuickReplyService>();
builder.Services.AddScoped<IMemoryService, MemoryService>();
builder.Services.AddScoped<IAvatarStateService, AvatarStateService>();
builder.Services.AddScoped<IConversationService, ConversationService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthorization();
app.MapControllers();

app.Run();
