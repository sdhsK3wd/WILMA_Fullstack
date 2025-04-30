using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using WILMABackend.Data;       // Korrekter Namespace
using WILMABackend.DTOs;      // Namespace für DTOs
using WILMABackend.Models;    // Korrekter Namespace

namespace WILMABackend.Controllers // Korrekter Namespace
{
    [ApiController]
    [Route("api/[controller]")] // Ergibt -> /api/Voting
    [Authorize]
    public class VotingController : ControllerBase
    {
        private readonly WilmaContext _context;
        private readonly ILogger<VotingController> _logger;

        public VotingController(WilmaContext context, ILogger<VotingController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/Voting
        /// <summary>
        /// Ruft alle aktiven Abstimmungen ab, inklusive der Stimmenanzahl pro Option
        /// und ob der aktuelle Benutzer bereits abgestimmt hat.
        /// (Angepasst für SQLite-Kompatibilität + Debug Logging)
        /// </summary>
        [HttpGet]
        [ProducesResponseType(typeof(List<PollDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> GetPolls()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null)
            {
                 _logger.LogWarning("GetPolls: User nicht authentifiziert (userId ist null).");
                return Unauthorized(new { message = "Benutzer nicht authentifiziert." });
            }

            // ✅ DEBUG: Logge die erkannte User ID
            _logger.LogInformation("GetPolls aufgerufen für User {UserId}", userId);

            try
            {
                // --- Schritt 1: Daten aus der DB holen (mit Includes) ---
                var pollsFromDb = await _context.Polls
                    .AsNoTracking()
                    .Include(p => p.Options)
                    .Include(p => p.Votes)   // Wichtig: Votes mitladen!
                    .OrderByDescending(p => p.CreatedAt)
                    .ToListAsync();

                _logger.LogInformation("GetPolls: {PollCount} Polls aus DB geladen.", pollsFromDb.Count);
                if (pollsFromDb.Any()) {
                    _logger.LogInformation("GetPolls: Beispiel Poll ID {ExamplePollId} hat {VoteCount} Votes geladen.", pollsFromDb.First().Id, pollsFromDb.First().Votes.Count);
                }


                // --- Schritt 2: Daten im Speicher in DTOs umwandeln ---
                var pollDtos = new List<PollDto>();
                foreach (var poll in pollsFromDb)
                {
                    // ✅ DEBUG: Logge die Suche nach der Stimme des Users für diesen Poll
                    _logger.LogDebug("GetPolls: Prüfe Poll ID {PollId}. Suche Vote für User ID {UserId} in {VoteCount} geladenen Votes.", poll.Id, userId, poll.Votes.Count);

                    // Finde die Stimme des aktuellen Benutzers für diesen Poll (im Speicher)
                    var userVote = poll.Votes.FirstOrDefault(v => v.UserId == userId);

                    // ✅ DEBUG: Logge das Ergebnis der Suche
                    if (userVote != null) {
                        _logger.LogInformation("GetPolls: Für Poll ID {PollId} wurde Vote gefunden! User {UserId} hat für Option {OptionId} gestimmt.", poll.Id, userId, userVote.PollOptionId);
                    } else {
                         _logger.LogInformation("GetPolls: Für Poll ID {PollId} wurde KEIN Vote für User {UserId} gefunden.", poll.Id, userId);
                    }

                    // Erstelle das DTO für den Poll
                    pollDtos.Add(new PollDto
                    {
                        Id = poll.Id,
                        Title = poll.Title,
                        Description = poll.Description,
                        CreatedBy = poll.CreatedBy,
                        CreatedAt = poll.CreatedAt,
                        TotalVotes = poll.Votes.Count,
                        // Setze UserVoteOptionId basierend auf dem gefundenen Vote
                        UserVoteOptionId = userVote?.PollOptionId, // Bleibt null, wenn userVote null ist
                        Options = poll.Options.Select(o => new PollOptionDto
                        {
                            Id = o.Id,
                            Text = o.Text,
                            Votes = poll.Votes.Count(v => v.PollOptionId == o.Id)
                        }).ToList()
                    });
                }

                _logger.LogInformation("GetPolls: DTO-Konvertierung abgeschlossen, {DtoCount} DTOs erstellt.", pollDtos.Count);
                return Ok(pollDtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetPolls: Fehler beim Laden oder Verarbeiten der Abstimmungen für User {UserId}.", userId);
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Ein interner Fehler ist beim Laden der Abstimmungen aufgetreten." });
            }
        }

        // --- POST CreatePoll() ---
        // (Code unverändert)
        [HttpPost("create")]
        [Authorize(Roles = "Admin")]
        [ProducesResponseType(typeof(PollDto), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> CreatePoll([FromBody] PollCreateRequest request)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userName = User.FindFirstValue(ClaimTypes.Name) ?? "Unbekannter Admin";
            if (userId == null) { return Unauthorized(new { message = "Benutzer nicht authentifiziert." }); }

            var poll = new Poll
            {
                Title = request.Title,
                Description = request.Description,
                CreatedBy = userName,
                CreatedAt = DateTime.UtcNow,
                Options = request.Options.Select(optText => new PollOption { Text = optText }).ToList()
            };
            _context.Polls.Add(poll);
            try
            {
                await _context.SaveChangesAsync();
                var createdPollDto = new PollDto {
                     Id = poll.Id, Title = poll.Title, Description = poll.Description, CreatedBy = poll.CreatedBy,
                     CreatedAt = poll.CreatedAt, TotalVotes = 0, UserVoteOptionId = null,
                     Options = poll.Options.Select(o => new PollOptionDto { Id = o.Id, Text = o.Text, Votes = 0 }).ToList()
                };
                return CreatedAtAction(nameof(GetPollById), new { pollId = poll.Id }, createdPollDto);
            }
            catch (DbUpdateException ex) { _logger.LogError(ex, "CreatePoll: DB Fehler User {UserId}.", userId); return StatusCode(500); }
            catch (Exception ex) { _logger.LogError(ex, "CreatePoll: Fehler User {UserId}.", userId); return StatusCode(500); }
        }


        // --- POST Vote() ---
        // (Code unverändert)
        [HttpPost("vote/{pollId:int}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Vote(int pollId, [FromBody] VoteRequestDto request)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) { return Unauthorized(new { message = "Benutzer nicht authentifiziert." }); }

            var pollOption = await _context.PollOptions.Include(o => o.Poll).FirstOrDefaultAsync(o => o.Id == request.OptionId && o.PollId == pollId);
            if (pollOption == null) { /* ... Fehlerbehandlung ... */ return NotFound(); }

            var existingVote = await _context.Votes.AsNoTracking().FirstOrDefaultAsync(v => v.UserId == userId && v.PollId == pollId);
            if (existingVote != null) { return BadRequest(new { message = "Du hast bereits für diese Abstimmung abgestimmt." }); }

            var vote = new Vote { UserId = userId, PollId = pollId, PollOptionId = request.OptionId, VotedAt = DateTime.UtcNow };
            _context.Votes.Add(vote);
            try
            {
                await _context.SaveChangesAsync();
                _logger.LogInformation("Vote: User {UserId} hat erfolgreich für Poll {PollId} (Option {OptionId}) abgestimmt.", userId, pollId, request.OptionId);
                return Ok(new { message = "Stimme erfolgreich abgegeben." });
            }
            catch (DbUpdateException ex) { /* ... Fehlerbehandlung ... */ return StatusCode(500); }
            catch (Exception ex) { /* ... Fehlerbehandlung ... */ return StatusCode(500); }
        }

        // --- GET GetPollById() ---
        // (Code unverändert, angepasst für SQLite)
        [HttpGet("{pollId:int}", Name = "GetPollById")]
        [ProducesResponseType(typeof(PollDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> GetPollById(int pollId)
        {
             var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
             if (userId == null) { return Unauthorized(new { message = "Benutzer nicht authentifiziert." }); }
             try
             {
                 var poll = await _context.Polls.AsNoTracking().Include(p => p.Options).Include(p => p.Votes).FirstOrDefaultAsync(p => p.Id == pollId);
                 if (poll == null) { return NotFound(new { message = $"Abstimmung mit ID {pollId} nicht gefunden." }); }
                 var userVote = poll.Votes.FirstOrDefault(v => v.UserId == userId);
                 var pollDto = new PollDto {
                     Id = poll.Id, Title = poll.Title, Description = poll.Description, CreatedBy = poll.CreatedBy,
                     CreatedAt = poll.CreatedAt, TotalVotes = poll.Votes.Count, UserVoteOptionId = userVote?.PollOptionId,
                     Options = poll.Options.Select(o => new PollOptionDto { Id = o.Id, Text = o.Text, Votes = poll.Votes.Count(v => v.PollOptionId == o.Id) }).ToList()
                 };
                 return Ok(pollDto);
             }
             catch (Exception ex) { _logger.LogError(ex, "GetPollById: Fehler User {UserId}, Poll {PollId}.", userId, pollId); return StatusCode(500); }
        }

        // --- DELETE DeletePoll() ---
        // (Code unverändert)
        [HttpDelete("{pollId:int}")]
        [Authorize(Roles = "Admin")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> DeletePoll(int pollId)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            _logger.LogInformation("DELETE /api/Voting/{PollId} aufgerufen von User {UserId}", pollId, userId);
            var pollToDelete = await _context.Polls.FirstOrDefaultAsync(p => p.Id == pollId);
            if (pollToDelete == null) { _logger.LogWarning("DeletePoll: Poll {PollId} nicht gefunden.", pollId); return NotFound(); }
            _context.Polls.Remove(pollToDelete);
            try
            {
                await _context.SaveChangesAsync();
                _logger.LogInformation("DeletePoll: Poll {PollId} gelöscht von User {UserId}.", pollId, userId);
                return NoContent();
            }
            catch (DbUpdateException ex) { _logger.LogError(ex, "DeletePoll: DB Fehler User {UserId}, Poll {PollId}.", userId, pollId); return StatusCode(500); }
            catch (Exception ex) { _logger.LogError(ex, "DeletePoll: Fehler User {UserId}, Poll {PollId}.", userId, pollId); return StatusCode(500); }
        }
    }
}
