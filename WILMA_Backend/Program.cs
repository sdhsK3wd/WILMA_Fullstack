using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using WILMABackend.Data;
using WILMABackend.Services;

var builder = WebApplication.CreateBuilder(args);
AppDomain.CurrentDomain.UnhandledException += (sender, e) =>
{
    Console.WriteLine("❌ UNHANDLED EXCEPTION:");
    Console.WriteLine(e.ExceptionObject?.ToString());
};


// ✅ Konfiguration laden
var config = builder.Configuration;

// ✅ Services hinzufügen
builder.Services.AddControllers();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<EmailService>();

// ✅ Datenbank einbinden
var connectionString = config.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<WilmaContext>(options =>
    options.UseSqlite(connectionString));

// ✅ CORS konfigurieren
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
{
    throw new Exception("❌ JWT Key fehlt! Prüfe appsettings.json oder den Build-Ordner.");
}

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

// ✅ Swagger mit JWT Unterstützung
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "WILMA API", Version = "v1" });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT eingeben mit 'Bearer ' davor.",
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
            new string[] {}
        }
    });
});

var app = builder.Build();

// ✅ Swagger aktivieren (nur in Development)
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ✅ Statische Dateien (z. B. Profilbilder)
app.UseStaticFiles();

// ✅ Routing aktivieren
app.UseRouting();

// ✅ Sicherheitsheader hinzufügen (vor der Response!)
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

// ✅ CORS aktivieren
app.UseCors("AllowFrontend");

// ✅ Authentifizierung und Autorisierung
app.UseAuthentication();
app.UseAuthorization();

// ✅ Controller-Routen
app.MapControllers();

// ✅ Automatische DB-Migration
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<WilmaContext>();
    db.Database.Migrate();
}

app.Run();
