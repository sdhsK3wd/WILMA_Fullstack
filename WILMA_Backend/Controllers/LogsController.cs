using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System; // Für DateTime
using System.Linq;
using System.Threading.Tasks;
using WILMABackend.Data; // Stelle sicher, dass der Namespace zu deinem DbContext korrekt ist
using WILMABackend.Models; // Stelle sicher, dass der Namespace zu deinem LogEntry Model korrekt ist

namespace WILMABackend.Controllers
{
    [Authorize(Roles = "Admin")] // Nur Admins dürfen auf Logs zugreifen
    [Route("api/logs")]       // Die Route, die dein Frontend erwartet
    [ApiController]
    public class LogsController : ControllerBase
    {
        private readonly WilmaContext _context; // Dein DbContext

        public LogsController(WilmaContext context)
        {
            _context = context;
        }
// DELETE: api/logs/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLog(int id)
        {
            var log = await _context.Logs.FindAsync(id);
            if (log == null)
            {
                return NotFound(new { message = "Log-Eintrag nicht gefunden." });
            }

            _context.Logs.Remove(log);
            await _context.SaveChangesAsync();

            return NoContent(); // 204 ohne Inhalt, typisch für erfolgreiches DELETE
        }

        // GET: api/logs
        // Akzeptiert jetzt Query-Parameter für die Filterung
        [HttpGet]
        public async Task<IActionResult> GetLogs(
            [FromQuery] string? level,
            [FromQuery] string? user,
            [FromQuery] string? startDate, // Datumsangaben als Strings empfangen
            [FromQuery] string? endDate)
        {
            var query = _context.Logs.AsQueryable(); // Beginne mit allen Logs aus dem DbSet 'Logs'

            // Filter nach Level (Severity)
            if (!string.IsNullOrEmpty(level) && level.ToLower() != "all")
            {
                query = query.Where(l => l.Level.ToUpper() == level.ToUpper());
            }

            // Filter nach Benutzer
            if (!string.IsNullOrEmpty(user) && user.ToLower() != "all")
            {
                // Annahme: Dein Log-Modell hat eine Eigenschaft 'User', die den Benutzernamen speichert.
                query = query.Where(l => l.User == user);
            }

            // Filter nach Startdatum
            if (!string.IsNullOrEmpty(startDate) && DateTime.TryParse(startDate, out DateTime parsedStartDate))
            {
                // Filtern ab Beginn des Tages (00:00:00)
                var startOfDay = parsedStartDate.Date;
                query = query.Where(l => l.Timestamp >= startOfDay);
            }

            // Filter nach Enddatum
            if (!string.IsNullOrEmpty(endDate) && DateTime.TryParse(endDate, out DateTime parsedEndDate))
            {
                // Filtern bis zum Ende des Tages (23:59:59.999)
                var endOfDay = parsedEndDate.Date.AddDays(1).AddTicks(-1);
                query = query.Where(l => l.Timestamp <= endOfDay);
            }

            var logs = await query
                           .OrderByDescending(log => log.Timestamp) // Neueste zuerst
                           .ToListAsync();
            
            // Wenn keine Logs gefunden werden (auch nach Filterung), wird eine leere Liste mit 200 OK zurückgegeben.
            return Ok(logs);
        }
    }
}