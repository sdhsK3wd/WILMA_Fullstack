using Microsoft.EntityFrameworkCore;


namespace WILMABackend.Data
{
    public class WilmaContext : DbContext
    {
        public WilmaContext(DbContextOptions<WilmaContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        // public DbSet<PasswordResetToken> PasswordResetTokens { get; set; }

    }
}