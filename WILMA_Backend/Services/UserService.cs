using System.Security.Cryptography;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WILMABackend.Data;
using BCrypt.Net;

namespace WILMABackend.Services
{
    public class UserService
    {
        private readonly WilmaContext _context;

        public UserService(WilmaContext context)
        {
            _context = context;
        }

        // 🟢 Benutzerregistrierung
        public async Task<bool> RegisterUser(string adminEmail, string username, string email, string password, string role)
        {
            var adminExists = await _context.Users.AnyAsync(u => u.Role == "Admin");

            if (role == "Admin" && adminExists && 
                (adminEmail == null || !(await _context.Users.AnyAsync(u => u.Email == adminEmail && u.Role == "Admin"))))
            {
                return false; // 只有 Admin 能创建 Admin（除非是第一个 Admin）
            }

            if (await _context.Users.AnyAsync(u => u.Username == username || u.Email == email))
            {
                return false;
            }

            string passwordHash = BCrypt.Net.BCrypt.HashPassword(password);

            var user = new User
            {
                Username = username,
                Email = email,
                PasswordHash = passwordHash,
                Role = role,
                IsOnline = false // 默认设置为离线
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            return true;
        }


        // 🟢 Benutzerauthentifizierung
      public async Task<User?> AuthenticateUser(string email, string password)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null) return null;

            // 如果 `password == "dummy"`，只返回用户信息，不检查密码
            if (password == "dummy") return user;

            bool isPasswordValid = BCrypt.Net.BCrypt.Verify(password, user.PasswordHash);
            return isPasswordValid ? user : null;
        }

        
        
        public async Task<bool> DeleteUser(int id)
        {
            var userToDelete = await _context.Users.FindAsync(id);
            if (userToDelete == null || userToDelete.Role == "Admin")
            {
                return false; // 不允许删除管理员
            }

            _context.Users.Remove(userToDelete);
            await _context.SaveChangesAsync();
            return true;
        }
        
    
    }
    
    
    
}