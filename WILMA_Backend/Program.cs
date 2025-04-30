using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using WILMABackend.Data;
using WILMABackend.Services;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// ✅ Globaler Fehler-Logger
AppDomain.CurrentDomain.UnhandledException += (sender, e) =>
{
    Console.WriteLine("❌ UNHANDLED EXCEPTION:");
    Console.WriteLine(e.ExceptionObject?.ToString());
};

// ✅ Konfiguration laden
var config = builder.Configuration;

// ✅ Services
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles; // 🔥 Verhindert Objektzyklen
        options.JsonSerializerOptions.WriteIndented = true;
    });

builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<EmailService>();

// ✅ DB konfigurieren
var connectionString = config.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<WilmaContext>(options =>
    options.UseSqlite(connectionString));

// ✅ CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5178")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// ✅ JWT Authentifizierung
var jwtKey = config["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey))
    throw new Exception("❌ JWT Key fehlt! Prüfe appsettings.json oder Umgebungsvariablen.");

var jwtIssuer = config["Jwt:Issuer"];
var jwtAudience = config["Jwt:Audience"];

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
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey!))
    };
});

// ✅ Swagger (für Tests mit JWT)
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "WILMA API", Version = "v1" });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Token mit 'Bearer' Präfix angeben.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement {
        {
            new OpenApiSecurityScheme {
                Reference = new OpenApiReference {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// ✅ Swagger aktivieren in Entwicklung
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ✅ Statische Dateien bereitstellen (z.B. Profilbilder)
app.UseStaticFiles();

// ✅ Routing
app.UseRouting();

// ✅ Zusätzliche Sicherheitsheader
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

// ✅ CORS & Auth
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();

// ✅ Controller-Routen aktivieren
app.MapControllers();

// ✅ Automatische DB-Migration bei Start
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<WilmaContext>();
    db.Database.Migrate(); // Achtung: Entferne Kommentar, wenn Migrationen vorhanden
}

app.Run();
