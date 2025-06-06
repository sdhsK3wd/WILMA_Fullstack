// Pfad: WILMABackend/Data/WilmaContext.cs
using Microsoft.EntityFrameworkCore;
using WILMABackend.Models; // Stelle sicher, dass der Namespace für User und BlacklistedToken korrekt ist

namespace WILMABackend.Data
{
    public class WilmaContext : DbContext
    {
        public WilmaContext(DbContextOptions<WilmaContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Poll> Polls { get; set; }
        public DbSet<PollOption> PollOptions { get; set; }
        public DbSet<Vote> Votes { get; set; }
        public DbSet<LogEntry> Logs { get; set; }
        public DbSet<BlacklistedToken> BlacklistedTokens { get; set; } // Dieser Eintrag ist korrekt [cite: 1598]

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Vote>()
                .HasIndex(v => new { v.UserId, v.PollId })
                .IsUnique();

            modelBuilder.Entity<Vote>()
                .HasOne(v => v.Poll)
                .WithMany(p => p.Votes)
                .HasForeignKey(v => v.PollId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Vote>()
                .HasOne(v => v.PollOption)
                .WithMany()
                .HasForeignKey(v => v.PollOptionId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PollOption>()
                .HasOne(opt => opt.Poll)
                .WithMany(p => p.Options)
                .HasForeignKey(opt => opt.PollId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}