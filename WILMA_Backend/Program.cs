using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using WILMABackend.Data;
using WILMABackend.Services;
using System.Text.Json.Serialization;
using WILMABackend.Filters; // NEU: Für TokenBlacklistFilter
// using Microsoft.Extensions.Logging; // Für ILogger, falls nicht schon vorhanden

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration; // [cite: 164]

// Globaler Fehler-Logger [cite: 163]
AppDomain.CurrentDomain.UnhandledException += (sender, e) =>
{
    // Hier solltest du einen richtigen Logger verwenden
    Console.WriteLine("❌ UNHANDLED EXCEPTION:");
    Console.WriteLine(e.ExceptionObject?.ToString());
};

// Services
builder.Services.AddControllers(options =>
    {
        options.Filters.Add<TokenBlacklistFilter>(); // NEU: Globalen Filter hinzufügen
    })
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles; // [cite: 164]
        options.JsonSerializerOptions.WriteIndented = true; // [cite: 164]
    });

builder.Services.AddScoped<LogService>(); // [cite: 165]
builder.Services.AddScoped<UserService>(); // [cite: 165]
builder.Services.AddScoped<EmailService>(); // [cite: 165]
builder.Services.AddScoped<TokenBlacklistFilter>(); // NEU: Filter im DI Container registrieren

// DB konfigurieren
var connectionString = config.GetConnectionString("DefaultConnection"); // [cite: 165]
builder.Services.AddDbContext<WilmaContext>(options =>
    options.UseSqlite(connectionString)); // [cite: 165]

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(config.GetValue<string>("AllowedHosts") ?? "http://localhost:5178") // Lade aus Konfiguration oder Fallback
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
}); // [cite: 166]

// JWT Authentifizierung
var jwtKey = config["Jwt:Key"]; // [cite: 167]
if (string.IsNullOrWhiteSpace(jwtKey))
    throw new Exception("❌ JWT Key fehlt! Prüfe appsettings.json oder Umgebungsvariablen."); // [cite: 167]
var jwtIssuer = config["Jwt:Issuer"]; // [cite: 168]
var jwtAudience = config["Jwt:Audience"]; // [cite: 168]

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true, // Wichtig!
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey!)), // [cite: 169]
        // Toleranz für Zeitunterschiede zwischen Servern (Clock Skew)
        // Standard ist 5 Minuten, kann bei Bedarf angepasst werden.
        // ClockSkew = TimeSpan.Zero // Wenn keine Toleranz gewünscht ist.
    };
});

// Swagger
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "WILMA API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Token mit 'Bearer' Präfix angeben. Beispiel: 'Bearer {token}'", // [cite: 169]
        Name = "Authorization", // [cite: 169]
        In = ParameterLocation.Header, // [cite: 169]
        Type = SecuritySchemeType.ApiKey, // [cite: 169]
        Scheme = "Bearer" // [cite: 169]
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement {
        {
            new OpenApiSecurityScheme {
                Reference = new OpenApiReference {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                } // [cite: 170]
            },
            Array.Empty<string>() // [cite: 171]
        }
    });
});

// NEU: Hintergrunddienst für Blacklist-Bereinigung
builder.Services.AddHostedService<TokenBlacklistCleanupService>();


var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage(); // [cite: 172]
    app.UseSwagger(); // [cite: 172]
    app.UseSwaggerUI(); // [cite: 172]
}

app.UseStaticFiles(); // [cite: 173]
app.UseRouting(); // [cite: 173]

// Sicherheitsheader (deine bestehende Implementierung ist gut) [cite: 174]
app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        context.Response.Headers["Cross-Origin-Resource-Policy"] = "same-origin";
        context.Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private";
        context.Response.Headers["Pragma"] = "no-cache";
        context.Response.Headers["Expires"] = "0";
        return Task.CompletedTask;
    });
    await next();
});


app.UseCors("AllowFrontend"); // [cite: 175]
app.UseAuthentication(); // Wichtig: Vor UseAuthorization
app.UseAuthorization(); // [cite: 175]

app.MapControllers(); // [cite: 175]

// Automatische DB-Migration bei Start (Vorsicht in Produktion)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<WilmaContext>();
    // db.Database.Migrate(); // [cite: 176] // Nur wenn Migrationen sicher angewendet werden sollen.
                            // Besser ist es, Migrationen explizit anzuwenden.
}

app.Run();