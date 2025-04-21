using Microsoft.AspNetCore.Mvc;
using WILMABackend.Services;
using System.IdentityModel.Tokens.Jwt;
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
using WILMABackend.Data;
using MailKit.Net.Smtp;
using MimeKit;
using WILMA_Backend.DTOs;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;



namespace WILMABackend.Controllers
{
    [ApiController]
    [Route("api/users")]
    public class UserController : ControllerBase
    {
        private readonly UserService _userService;
        private readonly WilmaContext _context;
        private readonly EmailService _emailService;
        private readonly IConfiguration _config;

        private bool IsStrongPassword(string password)
        {
            return password.Length >= 8 &&
                   password.Any(char.IsUpper) &&
                   password.Any(char.IsDigit) &&
                   password.Any(ch => !char.IsLetterOrDigit(ch));
        }

        public UserController(UserService userService, WilmaContext context, EmailService emailService, IConfiguration config)
        {
            _userService = userService;
            _context = context;
            _emailService = emailService ?? throw new ArgumentNullException(nameof(emailService));
            _config = config;
        }

        private void SendResetEmail(string email, string resetToken)
        {
            try
            {
                Console.WriteLine($"📧 Preparing to send email to: {email}");

                var message = new MimeMessage();
                message.From.Add(new MailboxAddress("Water Dashboard", "no-reply@water-dashboard.com"));
                message.To.Add(new MailboxAddress("", email));
                message.Subject = "Passwort zurücksetzen";

                message.Body = new TextPart("plain")
                {
                    Text = $"Setze dein Passwort zurück: https://yourfrontend.com/reset-password?token={resetToken}"
                };

                using (var client = new SmtpClient())
                {
                    client.Connect("smtp.your-email-provider.com", 587, false);
                    client.Authenticate("your-email@provider.com", "your-password");
                    client.Send(message);
                    client.Disconnect(true);
                }

                Console.WriteLine("✅ Email sent successfully!");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ ERROR: Email sending failed: {ex.Message}");
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _context.Users
                .Select(u => new { u.Id, u.Username, u.Email, u.Role, u.IsOnline })
                .ToListAsync();

            return Ok(users);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);

            if (user == null)
                return NotFound(new { message = "Benutzer nicht gefunden." });

            if (user.Role == "Admin")
                return BadRequest(new { message = "Admin kann nicht gelöscht werden!" });

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Benutzer erfolgreich gelöscht." });
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] UserRegisterDTO userDto)
        {
            var adminUser = await _userService.AuthenticateUser(userDto.AdminEmail, "dummy");
            if (adminUser == null || adminUser.Role != "Admin")
            {
                return Unauthorized(new { message = "Nur Admins dürfen Benutzer anlegen!" });
            }

            if (await _context.Users.AnyAsync(u => u.Email == userDto.Email))
            {
                return BadRequest(new { message = "Diese E-Mail ist bereits registriert." });
            }

            if (await _context.Users.AnyAsync(u => u.Username == userDto.Username))
            {
                return BadRequest(new { message = "Dieser Benutzername ist bereits vergeben." });
            }

            var validRoles = new[] { "admin", "user" };
            if (!validRoles.Contains(userDto.Role.ToLower()))
            {
                return BadRequest(new { message = "Ungültige Rolle. Erlaubt sind nur 'Admin' oder 'User'." });
            }

            userDto.Role = char.ToUpper(userDto.Role[0]) + userDto.Role.Substring(1).ToLower();

            if (!IsStrongPassword(userDto.Password))
            {
                return BadRequest(new
                {
                    message = "Passwort muss mindestens 8 Zeichen, einen Großbuchstaben und eine Zahl oder ein Sonderzeichen enthalten."
                });
            }

            bool success = await _userService.RegisterUser(
                userDto.AdminEmail,
                userDto.Username,
                userDto.Email,
                userDto.Password,
                userDto.Role
            );

            if (!success)
            {
                return BadRequest(new
                {
                    message = "Registrierung fehlgeschlagen. Admin-E-Mail prüfen oder Benutzer existiert bereits."
                });
            }

            return Ok(new { message = "Benutzer erfolgreich registriert." });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest loginRequest)
        {
            var email = loginRequest.Email;
            var password = loginRequest.Password;

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);

            if (user == null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
                return Unauthorized(new { message = "Login fehlgeschlagen." });

            user.IsOnline = true;
            user.RefreshToken = GenerateRefreshToken();
            user.RefreshTokenExpires = DateTime.UtcNow.AddDays(7);
            await _context.SaveChangesAsync();

            var token = GenerateJwtToken(user);

            return Ok(new
            {
                user.Id,
                user.Username,
                user.Email,
                user.Role,
                PhoneNumber = user.PhoneNumber ?? "Not set",
                Location = user.Location ?? "Not set",
                ProfileImageUrl = user.ProfileImageUrl ?? "",
                token,
                refreshToken = user.RefreshToken // ✅ Hinzufügen!
            });


        }

        [Authorize]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (userId == null)
                return Unauthorized();

            var user = await _context.Users.FindAsync(int.Parse(userId));
            if (user == null)
                return Unauthorized();

            user.IsOnline = false;
            user.RefreshToken = null;
            user.RefreshTokenExpires = null;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Erfolgreich ausgeloggt." });
        }
        
        [Authorize]
        [HttpGet("online-count")]
        public async Task<IActionResult> GetOnlineUserCount()
        {
            var onlineUsers = await _context.Users.CountAsync(u => u.IsOnline);
            return Ok(new { onlineUsers });
        }
        [Authorize(Roles = "Admin")]
        [HttpPost("upload-csv")]
        public async Task<IActionResult> UploadCsv(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Keine Datei hochgeladen." });

            var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/uploads");

            if (!Directory.Exists(uploadsPath))
                Directory.CreateDirectory(uploadsPath);

            var fileName = $"{Guid.NewGuid()}_{file.FileName}";
            var filePath = Path.Combine(uploadsPath, fileName);

            await using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return Ok(new { message = "CSV hochgeladen!", fileName });
        }

        [Authorize]
        [HttpPut("update-profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] ProfileUpdateDTO profileUpdateDTO)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == profileUpdateDTO.Email);

            if (user == null)
                return NotFound(new { message = "Benutzer nicht gefunden." });

            // 🚨 Sanitize user input to prevent XSS
            user.PhoneNumber = profileUpdateDTO.PhoneNumber?.Replace("<", "").Replace(">", "");
            user.Location = profileUpdateDTO.Location?.Replace("<", "").Replace(">", "");
            user.ProfileImageUrl = profileUpdateDTO.ProfileImageUrl;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Profil erfolgreich aktualisiert." });
        }




        [HttpPost("upload-profile-image")]
        public async Task<IActionResult> UploadProfileImage(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Kein Bild hochgeladen." });

            var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/profile-images");

            if (!Directory.Exists(uploadsPath))
                Directory.CreateDirectory(uploadsPath);

            var fileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
            var filePath = Path.Combine(uploadsPath, fileName);

            await using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var imageUrl = $"{Request.Scheme}://{Request.Host}/profile-images/{fileName}";

            return Ok(new { imageUrl });
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
        {
            Console.WriteLine($"🔍 Forgot Password request received for: {request.Email}");

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            if (user == null)
            {
                Console.WriteLine("🚨 ERROR: User not found");
                return NotFound(new { message = "E-Mail nicht gefunden" });
            }

            string resetToken;
            do
            {
                resetToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
            } while (await _context.Users.AnyAsync(u => u.PasswordResetToken == resetToken));

            user.PasswordResetToken = resetToken;
            user.ResetTokenExpires = DateTime.UtcNow.AddMinutes(30);
            await _context.SaveChangesAsync();

            Console.WriteLine($"✅ Reset Token Generated: {resetToken}");

            try
            {
                await _emailService.SendResetEmail(user.Email, resetToken);
                Console.WriteLine("✅ Email Sent Successfully!");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ ERROR: Email sending failed: {ex.Message}");
                return StatusCode(500, new { message = "Fehler beim Senden der E-Mail." });
            }

            return Ok(new { message = "Passwort-Zurücksetzen-Link wurde gesendet" });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            Console.WriteLine($"🔍 Reset Password Request - Token: {request.Token}");

            var user = await _context.Users.FirstOrDefaultAsync(u => u.PasswordResetToken == request.Token);

            if (user == null)
            {
                Console.WriteLine("❌ Kein Benutzer mit diesem Token gefunden.");
                return BadRequest(new { message = "Ungültiges oder abgelaufenes Token" });
            }

            if (user.ResetTokenExpires < DateTime.UtcNow)
            {
                Console.WriteLine("⏳ Token ist abgelaufen!");
                return BadRequest(new { message = "Token ist abgelaufen! Bitte fordere ein neues an." });
            }

            if (!IsStrongPassword(request.NewPassword))
            {
                return BadRequest(new
                {
                    message = "Passwort muss mindestens 8 Zeichen, einen Großbuchstaben und eine Zahl oder ein Sonderzeichen enthalten."
                });
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.PasswordResetToken = null;
            user.ResetTokenExpires = null;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Passwort erfolgreich zurückgesetzt" });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("all")]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _context.Users
                .Select(u => new {
                    u.Id,
                    u.Username,
                    u.Email,
                    u.Role,
                    ProfileImageUrl = u.ProfileImageUrl ?? ""
                })
                .ToListAsync();

            return Ok(users);
        }




        private string GenerateJwtToken(User user)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_config["Jwt:Key"]);

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(ClaimTypes.Email, user.Email),
                    new Claim(ClaimTypes.Role, user.Role)
                }),
                Expires = DateTime.UtcNow.AddSeconds(10), // in GenerateJwtToken



                Issuer = _config["Jwt:Issuer"],
                Audience = _config["Jwt:Audience"],
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"])),
                    SecurityAlgorithms.HmacSha256Signature)
            };


            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }



        private string GenerateRefreshToken()
        {
            return Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        }

        [HttpPost("refresh-token")]
        public async Task<IActionResult> RefreshToken([FromBody] RefreshRequest request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.RefreshToken == request.Token);

            if (user == null || user.RefreshTokenExpires < DateTime.UtcNow)
                return Unauthorized(new { message = "Ungültiger oder abgelaufener Refresh Token" });

            // ✨ Neue Tokens
            var newAccessToken = GenerateJwtToken(user);
            var newRefreshToken = GenerateRefreshToken();

            user.RefreshToken = newRefreshToken;
            user.RefreshTokenExpires = DateTime.UtcNow.AddDays(7);

            // ❗ WICHTIG: Änderungen erzwingen
            _context.Users.Update(user);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                token = newAccessToken,
                refreshToken = newRefreshToken
            });
        }







        public class RefreshRequest
        {
            public string Token { get; set; }
        }
    }
}