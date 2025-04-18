namespace WILMA_Backend.DTOs;

public class ProfileUpdateDTO
{
    public string Username { get; set; }
    public string Email { get; set; }
    public string PhoneNumber { get; set; }
    public string Location { get; set; }

    // ➡️ Neu hinzufügen:
    public string ProfileImageUrl { get; set; }
}