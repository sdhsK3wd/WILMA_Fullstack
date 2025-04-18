public class UserRegisterDTO
{
    public string Username { get; set; }
    public string Email { get; set; }
    public string Password { get; set; }
    public string Role { get; set; }
    public string AdminEmail { get; set; }
}

public class LoginRequest
{
    public string Email { get; set; }
    public string Password { get; set; }
}

public class LogoutRequest
{
    public string Email { get; set; }
}

public class ForgotPasswordRequest
{
    public string Email { get; set; }
}

public class ResetPasswordRequest
{
    public string Token { get; set; }
    public string NewPassword { get; set; }
}