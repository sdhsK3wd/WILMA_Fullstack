using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using WILMABackend.Data;
using WILMABackend.Services;

var builder = WebApplication.CreateBuilder(args);

// ✅ Konfiguration laden
var config = builder.Configuration;

// ✅ Add services
builder.Services.AddControllers();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<EmailService>();

// ✅ Datenbank einbinden
var connectionString = config.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<WilmaContext>(options =>
    options.UseSqlite(connectionString));

// ✅ CORS aktivieren (für dein Frontend-Port)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5178")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// ✅ JWT Auth hinzufügen
var jwtKey = config["Jwt:Key"];
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

// ✅ Swagger mit JWT-Unterstützung
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "WILMA API", Version = "v1" });

    // 🔐 Authorize-Button hinzufügen
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Gib hier den JWT ein (mit 'Bearer ' davor)",
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

// ✅ Swagger aktivieren im Development-Modus
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ✅ Statische Dateien erlauben (z. B. für Profilbilder)
app.UseStaticFiles();

// ✅ CORS aktivieren
app.UseCors("AllowFrontend");

// ✅ HTTPS und Auth
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// ✅ Datenbank-Migration automatisch ausführen
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<WilmaContext>();
    db.Database.Migrate();
}

app.Run();
