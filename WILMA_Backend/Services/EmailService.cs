using System;
using System.IO;
using System.Net;
using System.Net.Mail;
using System.Threading.Tasks;

namespace WILMABackend.Services
{
    public class EmailService
    {
        private readonly string _smtpServer = "smtp.gmail.com"; // ✅ Gmail SMTP-Server
        private readonly int _smtpPort = 587; // ✅ Standardport für Gmail SMTP
        private readonly string _emailFrom = "koko.vardia12@gmail.com"; // ✅ Deine E-Mail-Adresse
        private readonly string _emailPassword = "ihiojxgnrlysvpys"; // ❌ Nutze sichere Speicherung!

        public async Task SendResetEmail(string toEmail, string token)
        {
            var resetUrl = $"http://localhost:5178/forgot-password?token={token}";
            var logoPath = @"C:\Users\user\Desktop\WILMA_Backend\imagees\Logo.png"; // Dein Logo-Pfad

            using (var client = new SmtpClient(_smtpServer, _smtpPort))
            {
                client.Credentials = new NetworkCredential(_emailFrom, _emailPassword);
                client.EnableSsl = true;

                var mailMessage = new MailMessage
                {
                    From = new MailAddress(_emailFrom),
                    Subject = "Password Reset Request",
                    Body = $"Click the link to reset your password: {resetUrl}",
                    IsBodyHtml = true
                };
                mailMessage.To.Add(toEmail);

                // 📌 Logo als Anhang hinzufügen
                var logoAttachment = new Attachment(logoPath);
                logoAttachment.ContentId = "logoImage";
                mailMessage.Attachments.Add(logoAttachment);

                // ✅ HTML mit eingebettetem Bild
                string emailBody = $@"
        <html>
        <body style='font-family: Arial, sans-serif; text-align: center; background-color: #f8f8f8; padding: 20px;'>
            
            <div style='max-width: 600px; background: white; padding: 20px; border-radius: 10px; 
                        box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1); margin: auto;'>
                
                <!-- Logo als eingebettetes Bild -->
                <img src='cid:logoImage' alt='Company Logo' style='max-width: 120px; margin-bottom: 10px;'>

                <!-- Titel -->
                <h2 style='color: #333;'><strong>Reset your password</strong></h2>

                <p style='color: #666; font-size: 16px;'>
                    We received a request to reset your password. Click the button below to proceed.
                </p>

                <!-- Reset-Button -->
                <a href='{resetUrl}' 
                   style='display: inline-block; padding: 12px 24px; font-size: 18px; 
                          color: white; background-color: #4CAF50; text-decoration: none; 
                          border-radius: 5px; font-weight: bold; margin-top: 20px;'>
                   Reset Password
                </a>

                <p style='color: #999; font-size: 14px; margin-top: 20px;'>
                    If you didn't request a password reset, you can ignore this email.
                </p>
            </div>

        </body>
        </html>";

                mailMessage.Body = emailBody;

                try
                {
                    await client.SendMailAsync(mailMessage);
                    Console.WriteLine("✅ Email sent successfully with embedded image!");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"❌ ERROR: Failed to send email: {ex.Message}");
                    throw;
                }
            }
        }

    }
}
