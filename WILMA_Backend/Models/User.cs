using System.ComponentModel.DataAnnotations;

public class User
{
    [Key]
    public int Id { get; set; }

    [Required]
    public string Username { get; set; }

    [Required, EmailAddress]
    public string Email { get; set; }

    [Required]
    public string PasswordHash { get; set; }

    public string Role { get; set; } = "User";

    public string? PasswordResetToken { get; set; }
    public DateTime? ResetTokenExpires { get; set; }

    public bool IsOnline { get; set; } = false;

    // Neu hinzugefügte Felder für das Profil
    public string? PhoneNumber { get; set; }
    public string? Location { get; set; }
    public string? ProfileImageUrl { get; set; }
}