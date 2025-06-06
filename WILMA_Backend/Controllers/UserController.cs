using Microsoft.AspNetCore.Mvc;
using WILMABackend.Services;
using System.IdentityModel.Tokens.Jwt; // Für JwtRegisteredClaimNames
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;
using System;
using System.Threading.Tasks;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;
using MailKit.Net.Smtp;
using WILMABackend.Data;
using WILMA_Backend.DTOs; // Beachte den Namespace, falls unterschiedlich
using Microsoft.AspNetCore.Authorization;
using MimeKit;
using WILMABackend.Models; // Für User und BlacklistedToken

// Stelle sicher, dass alle using-Direktiven vorhanden und korrekt sind.
// Insbesondere für MimeMessage, MailboxAddress, TextPart, SmtpClient aus MailKit.Net.Smtp und MimeKit, falls SendResetEmail hier bleibt.

namespace WILMABackend.Controllers
{
    [ApiController]
    [Route("api/users")]
    public class UserController : ControllerBase
    {
        private readonly UserService _userService;
        private readonly WilmaContext _context; // [cite: 4]
        private readonly EmailService _emailService;
        private readonly IConfiguration _config;
        private readonly LogService _logService; // [cite: 4]

        private bool IsStrongPassword(string password)
        {
            return password.Length >= 8 &&
                   password.Any(char.IsUpper) &&
                   password.Any(char.IsDigit) &&
                   password.Any(ch => !char.IsLetterOrDigit(ch)); // [cite: 5]
        }

        public UserController(UserService userService, WilmaContext context, EmailService emailService, IConfiguration config, LogService logService)
        {
            _userService = userService;
            _context = context; // [cite: 7]
            _emailService = emailService ?? throw new ArgumentNullException(nameof(emailService));
            _config = config;
            _logService = logService;
        }

        // ... (Andere Methoden wie GetUsers, DeleteUser, Register, etc. bleiben weitgehend gleich)
        // Die SendResetEmail Methode sollte idealerweise in den EmailService ausgelagert werden.
        // Ich lasse sie hier der Vollständigkeit halber, aber mit dem Hinweis.

        private void SendResetEmail(string email, string resetToken) // Diese Methode gehört eher in den EmailService
        {
            try
            {
                Console.WriteLine($"📧 Preparing to send email to: {email}");
                var message = new MimeMessage(); // [cite: 9]
                message.From.Add(new MailboxAddress("Water Dashboard", "no-reply@water-dashboard.com")); // [cite: 9]
                message.To.Add(new MailboxAddress("", email)); // [cite: 9]
                message.Subject = "Passwort zurücksetzen"; // [cite: 9]
                message.Body = new TextPart("plain") // [cite: 10]
                {
                    Text = $"Setze dein Passwort zurück: https://yourfrontend.com/reset-password?token={resetToken}" // [cite: 10]
                };

                using (var client = new SmtpClient()) // [cite: 11]
                {
                    // Konfiguration für SMTP sollte aus IConfiguration geladen werden
                    client.Connect(_config["Smtp:Host"], int.Parse(_config["Smtp:Port"]), bool.Parse(_config["Smtp:UseSsl"]));
                    client.Authenticate(_config["Smtp:Username"], _config["Smtp:Password"]);
                    client.Send(message); // [cite: 12]
                    client.Disconnect(true); // [cite: 12]
                }
                Console.WriteLine("✅ Email sent successfully!");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ ERROR: Email sending failed: {ex.Message}"); // [cite: 13]
                // Hier sollte ein richtiger Logger verwendet werden
                _logService.LogInfo("System", $"Email sending failed to {email}", ex); // Beispiel für Logging
            }
        }


        [HttpGet]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _context.Users
                .Select(u => new { u.Id, u.Username, u.Email, u.Role, u.IsOnline })
                .ToListAsync(); // [cite: 14]
            return Ok(users); // [cite: 15]
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id); // [cite: 15]
            if (user == null)
                return NotFound(new { message = "Benutzer nicht gefunden." }); // [cite: 16]
            if (user.Role == "Admin")
                return BadRequest(new { message = "Admin kann nicht gelöscht werden!" }); // [cite: 17]
            _context.Users.Remove(user); // [cite: 18]
            await _context.SaveChangesAsync(); // [cite: 18]

            return Ok(new { message = "Benutzer erfolgreich gelöscht." });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] UserRegisterDTO userDto)
        {
            // Die Authentifizierung des Admins sollte über den aktuellen Token des Admins erfolgen,
            // nicht durch erneute Eingabe von Admin-E-Mail und einem "dummy" Passwort.
            // Die [Authorize(Roles="Admin")] Annotation stellt bereits sicher, dass nur ein Admin diese Methode aufrufen kann.

            // var adminUser = await _userService.AuthenticateUser(userDto.AdminEmail, "dummy"); [cite: 19]
            // if (adminUser == null || adminUser.Role != "Admin") [cite: 19, 20]
            // {
            //     return Unauthorized(new { message = "Nur Admins dürfen Benutzer anlegen!" }); [cite: 20]
            // }
            // Stattdessen:
            var callingAdminEmail = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrEmpty(callingAdminEmail))
            {
                 return Unauthorized(new { message = "Admin-Identität konnte nicht überprüft werden." });
            }


            if (await _context.Users.AnyAsync(u => u.Email == userDto.Email))
            {
                return BadRequest(new { message = "Diese E-Mail ist bereits registriert." }); // [cite: 21]
            }

            if (await _context.Users.AnyAsync(u => u.Username == userDto.Username))
            {
                return BadRequest(new { message = "Dieser Benutzername ist bereits vergeben." }); // [cite: 22]
            }

            var validRoles = new[] { "admin", "user" }; // [cite: 23]
            if (!validRoles.Contains(userDto.Role.ToLower())) // [cite: 24]
            {
                return BadRequest(new { message = "Ungültige Rolle. Erlaubt sind nur 'Admin' oder 'User'." }); // [cite: 24]
            }

            userDto.Role = char.ToUpper(userDto.Role[0]) + userDto.Role.Substring(1).ToLower(); // [cite: 25]
            if (!IsStrongPassword(userDto.Password)) // [cite: 25, 26]
            {
                return BadRequest(new
                {
                    message = "Passwort muss mindestens 8 Zeichen, einen Großbuchstaben und eine Zahl oder ein Sonderzeichen enthalten."
                }); // [cite: 26]
            }

            bool success = await _userService.RegisterUser(
                callingAdminEmail, // Verwende die E-Mail des aufrufenden Admins
                userDto.Username,
                userDto.Email,
                userDto.Password,
                userDto.Role
            ); // [cite: 27]

            if (!success)
            {
                return BadRequest(new
                {
                    message = "Registrierung fehlgeschlagen. Admin-E-Mail prüfen oder Benutzer existiert bereits."
                }); // [cite: 28, 29]
            }

            return Ok(new { message = "Benutzer erfolgreich registriert." }); // [cite: 29]
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest loginRequest)
        {
            var email = loginRequest.Email; // [cite: 30]
            var password = loginRequest.Password; // [cite: 31]

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email); // [cite: 31]
            if (user == null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash)) // [cite: 32]
                return Unauthorized(new { message = "Login fehlgeschlagen." }); // [cite: 32]

            user.IsOnline = true; // [cite: 33]
            user.RefreshToken = GenerateRefreshToken(); // [cite: 33]
            user.RefreshTokenExpires = DateTime.UtcNow.AddDays(7); // [cite: 33]
            await _context.SaveChangesAsync();

            var token = GenerateJwtToken(user);
            await _logService.LogInfo(user.Username, $"Benutzer {user.Username} ({user.Role}) hat sich eingeloggt."); // [cite: 34]

            return Ok(new
            {
                user.Id,
                user.Username,
                user.Email,
                user.Role,
                PhoneNumber = user.PhoneNumber ?? "Not set", // [cite: 35]
                Location = user.Location ?? "Not set", // [cite: 35]
                ProfileImageUrl = user.ProfileImageUrl ?? "", // [cite: 35]
                token,
                refreshToken = user.RefreshToken
            });
        }

        [Authorize]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value; // [cite: 36]
            if (userId == null)
                return Unauthorized(); // [cite: 37]

            var user = await _context.Users.FindAsync(int.Parse(userId)); // [cite: 38]
            if (user == null)
                return Unauthorized(); // [cite: 38]

            // Token zur Blacklist hinzufügen
            var jti = User.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;
            var expClaim = User.FindFirst(JwtRegisteredClaimNames.Exp)?.Value; // "exp" ist der Standard-Claim-Name für Expiration

            if (!string.IsNullOrEmpty(jti) && long.TryParse(expClaim, out long expUnixSeconds))
            {
                var expirationDateTimeUtc = DateTimeOffset.FromUnixTimeSeconds(expUnixSeconds).UtcDateTime;

                // Nur zur Blacklist hinzufügen, wenn der Token noch nicht abgelaufen ist
                if (expirationDateTimeUtc > DateTime.UtcNow)
                {
                    var blacklistedToken = new BlacklistedToken
                    {
                        TokenId = jti,
                        ExpirationDate = expirationDateTimeUtc
                    };

                    // Verhindern, dass derselbe Token mehrmals hinzugefügt wird (optional, aber gut)
                    if (!await _context.BlacklistedTokens.AnyAsync(bt => bt.TokenId == jti))
                    {
                        _context.BlacklistedTokens.Add(blacklistedToken);
                    }
                }
            }

            user.IsOnline = false; // [cite: 39]
            await _logService.LogInfo(user.Username, $"Benutzer {user.Username} ({user.Role}) hat sich ausgeloggt."); // [cite: 39]
            user.RefreshToken = null; // [cite: 39]
            user.RefreshTokenExpires = null; // [cite: 39]
            await _context.SaveChangesAsync(); // [cite: 39]
            return Ok(new { message = "Erfolgreich ausgeloggt." }); // [cite: 40]
        }


        [Authorize]
        [HttpGet("online-count")]
        public async Task<IActionResult> GetOnlineUserCount()
        {
            var onlineUsers = await _context.Users.CountAsync(u => u.IsOnline); // [cite: 40]
            return Ok(new { onlineUsers }); // [cite: 41]
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("upload-csv")]
        public async Task<IActionResult> UploadCsv(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Keine Datei hochgeladen." }); // [cite: 41]
            var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/uploads"); // [cite: 42]

            if (!Directory.Exists(uploadsPath))
                Directory.CreateDirectory(uploadsPath); // [cite: 42]
            var fileName = $"{Guid.NewGuid()}_{file.FileName}"; // [cite: 43]
            var filePath = Path.Combine(uploadsPath, fileName); // [cite: 43]

            await using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream); // [cite: 43]
            }

            return Ok(new { message = "CSV hochgeladen!", fileName }); // [cite: 44]
        }

        [Authorize]
        [HttpPut("update-profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] ProfileUpdateDTO profileUpdateDTO)
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value; // [cite: 45]
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(new { message = "User-ID nicht gefunden." }); // [cite: 46]
            var user = await _context.Users.FindAsync(int.Parse(userId)); // [cite: 47]

            if (user == null)
                return NotFound(new { message = "Benutzer nicht gefunden." }); // [cite: 47]

            user.PhoneNumber = profileUpdateDTO.PhoneNumber?.Replace("<", "").Replace(">", ""); // [cite: 48]
            user.Location = profileUpdateDTO.Location?.Replace("<", "").Replace(">", ""); // [cite: 49]

            await _context.SaveChangesAsync();

            return Ok(new { message = "Profil erfolgreich aktualisiert." }); // [cite: 49]
        }


        [Authorize]
        [HttpPost("upload-profile-image")]
        public async Task<IActionResult> UploadProfileImage(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Kein Bild hochgeladen." }); // [cite: 50]
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value; // [cite: 51]
            if (string.IsNullOrEmpty(userIdClaim))
                return Unauthorized(new { message = "User-ID nicht gefunden." }); // [cite: 51]
            var user = await _context.Users.FindAsync(int.Parse(userIdClaim)); // [cite: 52]
            if (user == null)
                return NotFound(new { message = "Benutzer nicht gefunden." }); // [cite: 52]
            var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/profile-images"); // [cite: 53]

            if (!Directory.Exists(uploadsPath))
                Directory.CreateDirectory(uploadsPath); // [cite: 53]
            var fileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}"; // [cite: 54]
            var filePath = Path.Combine(uploadsPath, fileName); // [cite: 54]

            await using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream); // [cite: 54]
            }

            var imageUrl = $"{Request.Scheme}://{Request.Host}/profile-images/{fileName}"; // [cite: 55]
            user.ProfileImageUrl = imageUrl; // [cite: 56]
            _context.Users.Update(user); // [cite: 57]
            await _context.SaveChangesAsync(); // [cite: 57]

            return Ok(new { imageUrl }); // [cite: 58]
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
        {
            Console.WriteLine($"🔍 Forgot Password request received for: {request.Email}"); // [cite: 59]
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email); // [cite: 60]
            if (user == null)
            {
                Console.WriteLine("🚨 ERROR: User not found"); // [cite: 60]
                return NotFound(new { message = "E-Mail nicht gefunden" }); // [cite: 61]
            }

            string resetToken;
            do
            {
                resetToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)); // [cite: 62]
            } while (await _context.Users.AnyAsync(u => u.PasswordResetToken == resetToken)); // [cite: 63]

            user.PasswordResetToken = resetToken; // [cite: 63]
            user.ResetTokenExpires = DateTime.UtcNow.AddMinutes(30); // [cite: 63]
            await _context.SaveChangesAsync(); // [cite: 63]
            Console.WriteLine($"✅ Reset Token Generated: {resetToken}"); // [cite: 64]

            try
            {
                await _emailService.SendResetEmail(user.Email, resetToken); // [cite: 64] // Besser: SendResetEmail aus UserController hier aufrufen
                // SendResetEmail(user.Email, resetToken); // Wenn die Methode hier bleibt
                Console.WriteLine("✅ Email Sent Successfully!"); // [cite: 65]
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ ERROR: Email sending failed: {ex.Message}"); // [cite: 65]
                return StatusCode(500, new { message = "Fehler beim Senden der E-Mail." }); // [cite: 66]
            }

            return Ok(new { message = "Passwort-Zurücksetzen-Link wurde gesendet" }); // [cite: 67]
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            Console.WriteLine($"🔍 Reset Password Request - Token: {request.Token}"); // [cite: 68]
            var user = await _context.Users.FirstOrDefaultAsync(u => u.PasswordResetToken == request.Token); // [cite: 69]

            if (user == null)
            {
                Console.WriteLine("❌ Kein Benutzer mit diesem Token gefunden."); // [cite: 69]
                return BadRequest(new { message = "Ungültiges oder abgelaufenes Token" }); // [cite: 70]
            }

            if (user.ResetTokenExpires < DateTime.UtcNow) // [cite: 71]
            {
                Console.WriteLine("⏳ Token ist abgelaufen!"); // [cite: 71]
                return BadRequest(new { message = "Token ist abgelaufen! Bitte fordere ein neues an." }); // [cite: 72]
            }

            if (!IsStrongPassword(request.NewPassword)) // [cite: 73]
            {
                return BadRequest(new
                {
                    message = "Passwort muss mindestens 8 Zeichen, einen Großbuchstaben und eine Zahl oder ein Sonderzeichen enthalten."
                }); // [cite: 73, 74]
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword); // [cite: 75]
            user.PasswordResetToken = null; // [cite: 75]
            user.ResetTokenExpires = null; // [cite: 76]

            await _context.SaveChangesAsync(); // [cite: 76]

            return Ok(new { message = "Passwort erfolgreich zurückgesetzt" }); // [cite: 76]
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("all")]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _context.Users
                .Select(u => new {
                    u.Id,
                    u.Username, // [cite: 78]
                    u.Email,
                    u.Role,
                    ProfileImageUrl = u.ProfileImageUrl ?? ""
                })
                .ToListAsync(); // [cite: 79]

            return Ok(users); // [cite: 79]
        }

        private string GenerateJwtToken(User user)
        {
            var tokenHandler = new JwtSecurityTokenHandler(); // [cite: 80]
            var key = Encoding.UTF8.GetBytes(_config["Jwt:Key"]); // [cite: 81]

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(ClaimTypes.Email, user.Email),
                    new Claim(ClaimTypes.Role, user.Role), // [cite: 82]
                    new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()) // NEU: JWT ID
                }),
                // Die Lebensdauer des Access Tokens sollte kurz sein. 1-15 Minuten sind üblich.
                // 10 Sekunden ist sehr kurz und nur für Tests gut. Für Produktion eher 5-15 Minuten.
                Expires = DateTime.UtcNow.AddMinutes(15), // Geändert von 10 Sekunden auf 15 Minuten
                Issuer = _config["Jwt:Issuer"], // [cite: 82]
                Audience = _config["Jwt:Audience"], // [cite: 82]
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(key), // Key direkt verwenden
                    SecurityAlgorithms.HmacSha256Signature) // [cite: 83]
            };
            var token = tokenHandler.CreateToken(tokenDescriptor); // [cite: 84]
            return tokenHandler.WriteToken(token); // [cite: 84]
        }

        private string GenerateRefreshToken()
        {
            return Convert.ToBase64String(RandomNumberGenerator.GetBytes(64)); // [cite: 84]
        }

        [HttpPost("refresh-token")]
        public async Task<IActionResult> RefreshToken([FromBody] RefreshRequest request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.RefreshToken == request.Token); // [cite: 85]
            if (user == null || user.RefreshTokenExpires < DateTime.UtcNow) // [cite: 86]
                return Unauthorized(new { message = "Ungültiger oder abgelaufener Refresh Token" }); // [cite: 86]

            var newAccessToken = GenerateJwtToken(user); // [cite: 87]
            var newRefreshToken = GenerateRefreshToken(); // Optional: Refresh Token Rotation (neuen Refresh Token generieren)

            user.RefreshToken = newRefreshToken; // Alten Refresh Token durch neuen ersetzen (Rotation) [cite: 88]
            user.RefreshTokenExpires = DateTime.UtcNow.AddDays(7); // [cite: 88]
            _context.Users.Update(user); // [cite: 89]
            await _context.SaveChangesAsync(); // [cite: 89]

            return Ok(new
            {
                token = newAccessToken,
                refreshToken = newRefreshToken
            }); // [cite: 90]
        }

        public class RefreshRequest
        {
            public string Token { get; set; } // [cite: 91]
        }

        // DTOs sollten in eigene Dateien ausgelagert werden (z.B. in einen DTOs Ordner)
        // Ich lasse sie hier zur Vereinfachung, aber das ist kein Best Practice.
        // public class UserRegisterDTO { ... }
        // public class LoginRequest { ... }
        // public class LogoutRequest { ... } // LogoutRequest wird aktuell nicht verwendet, da Logout über Token im Header geht.
        // public class ForgotPasswordRequest { ... }
        // public class ResetPasswordRequest { ... }
        // public class ProfileUpdateDTO { ... } // Diese Klasse fehlt in der ursprünglichen Datei, aber wird in UpdateProfile verwendet.
                                             // Du musst sie definieren, z.B.:
                                             // public class ProfileUpdateDTO { public string PhoneNumber { get; set; } public string Location { get; set; } }
    }
}

// Definition für ProfileUpdateDTO, falls noch nicht vorhanden:
// Erstelle eine Datei ProfileUpdateDTO.cs im DTOs Ordner
/*
namespace WILMA_Backend.DTOs // Oder dein DTO Namespace
{
    public class ProfileUpdateDTO
    {
        public string? PhoneNumber { get; set; }
        public string? Location { get; set; }
    }
}
*/