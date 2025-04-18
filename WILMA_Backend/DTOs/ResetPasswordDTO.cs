namespace WILMA_Backend.DTOs;

public class ResetPasswordRequest
{
    public string Token { get; set; }
    public string NewPassword { get; set; }
}