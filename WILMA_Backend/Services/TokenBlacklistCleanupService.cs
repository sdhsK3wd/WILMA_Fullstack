using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging; // Optional für Logging
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using WILMABackend.Data; // Dein DbContext Namespace

namespace WILMABackend.Services // Oder dein gewünschter Namespace für Services
{
    public class TokenBlacklistCleanupService : IHostedService, IDisposable
    {
        private Timer _timer;
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<TokenBlacklistCleanupService> _logger; // Optional

        public TokenBlacklistCleanupService(IServiceProvider serviceProvider, ILogger<TokenBlacklistCleanupService> logger) // Logger optional
        {
            _serviceProvider = serviceProvider ?? throw new ArgumentNullException(nameof(serviceProvider));
            _logger = logger; // Optional
        }

        public Task StartAsync(CancellationToken cancellationToken)
        {
            _logger?.LogInformation("Token Blacklist Cleanup Service is starting.");
            // Timer so einstellen, dass er nicht sofort bei jedem Start während der Entwicklung ausgeführt wird,
            // sondern z.B. nach einer Minute startet und dann stündlich.
            _timer = new Timer(DoWork, null, TimeSpan.FromMinutes(1), TimeSpan.FromHours(1));
            return Task.CompletedTask;
        }

        private async void DoWork(object state)
        {
            _logger?.LogInformation("Token Blacklist Cleanup Service is working.");
            using (var scope = _serviceProvider.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<WilmaContext>();
                try
                {
                    var expiredTokens = await context.BlacklistedTokens
                                                     .Where(t => t.ExpirationDate <= DateTime.UtcNow)
                                                     .ToListAsync();
                    if (expiredTokens.Any())
                    {
                        context.BlacklistedTokens.RemoveRange(expiredTokens);
                        await context.SaveChangesAsync();
                        _logger?.LogInformation($"🗑️ {expiredTokens.Count} abgelaufene Tokens aus der Blacklist entfernt.");
                        Console.WriteLine($"🗑️ {expiredTokens.Count} abgelaufene Tokens aus der Blacklist entfernt."); // Behalte Konsolenausgabe bei, wenn gewünscht
                    }
                    else
                    {
                         _logger?.LogInformation("Keine abgelaufenen Tokens in der Blacklist gefunden.");
                    }
                }
                catch (Exception ex)
                {
                    _logger?.LogError(ex, "Fehler beim Aufräumen der Token-Blacklist.");
                     Console.WriteLine($"❌ ERROR: Fehler beim Aufräumen der Token-Blacklist: {ex.Message}");
                }
            }
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            _logger?.LogInformation("Token Blacklist Cleanup Service is stopping.");
            _timer?.Change(Timeout.Infinite, 0);
            return Task.CompletedTask;
        }

        public void Dispose()
        {
            _timer?.Dispose();
        }
    }
}