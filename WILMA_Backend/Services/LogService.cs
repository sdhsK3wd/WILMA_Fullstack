using System.Text.Json;
using System.Threading.Tasks;
using WILMABackend.Data;
using WILMABackend.Models;

namespace WILMABackend.Services
{
    public class LogService
    {
        private readonly WilmaContext _context;

        public LogService(WilmaContext context)
        {
            _context = context;
        }

        public async Task LogInfo(string user, string message, object? details = null)
        {
            var entry = new LogEntry
            {
                Level = "INFO",
                User = user,
                Message = message,
                DetailsJson = details != null ? JsonSerializer.Serialize(details) : null
            };

            _context.Logs.Add(entry);
            await _context.SaveChangesAsync();
        }
    }
}