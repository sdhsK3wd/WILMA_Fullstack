using Microsoft.EntityFrameworkCore;
using WILMABackend.Models; // Namespace vereinheitlicht
// Ggf. using für User-Modell hinzufügen

namespace WILMABackend.Data // Namespace vereinheitlicht
{
    public class WilmaContext : DbContext
    {
        public WilmaContext(DbContextOptions<WilmaContext> options) : base(options) { }

        // --- DbSets ---
        public DbSet<User> Users { get; set; } // Sicherstellen, dass das User-Modell korrekt definiert ist
        public DbSet<Poll> Polls { get; set; }
        public DbSet<PollOption> PollOptions { get; set; }
        public DbSet<Vote> Votes { get; set; } // Verwende dieses DbSet für Stimmen

        // Entfernt:
        // public DbSet<VoteOption> VoteOptions { get; set; } // Alte, redundante Definition
        // public DbSet<UserVote> UserVotes { get; set; } // Altes, redundantes Modell

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // --- Konfigurationen ---

            // Sicherstellen, dass ein User nur einmal pro Poll abstimmen kann
            // (Unique Constraint über UserId und PollId)
            modelBuilder.Entity<Vote>()
                .HasIndex(v => new { v.UserId, v.PollId })
                .IsUnique();

            // Beziehung: Vote -> Poll (Viele-zu-Eins)
            modelBuilder.Entity<Vote>()
                .HasOne(v => v.Poll)
                .WithMany(p => p.Votes) // Ein Poll hat viele Votes
                .HasForeignKey(v => v.PollId)
                .OnDelete(DeleteBehavior.Cascade); // Wenn ein Poll gelöscht wird, werden auch die Votes gelöscht

            // Beziehung: Vote -> PollOption (Viele-zu-Eins)
            modelBuilder.Entity<Vote>()
                .HasOne(v => v.PollOption)
                .WithMany() // Eine PollOption hat keine direkte Sammlung von Votes in diesem Modell
                .HasForeignKey(v => v.PollOptionId)
                .OnDelete(DeleteBehavior.Restrict); // Verhindert das Löschen einer Option, wenn Stimmen dafür existieren

            // Beziehung: PollOption -> Poll (Viele-zu-Eins)
             modelBuilder.Entity<PollOption>()
                .HasOne(opt => opt.Poll)
                .WithMany(p => p.Options) // Ein Poll hat viele Optionen
                .HasForeignKey(opt => opt.PollId)
                .OnDelete(DeleteBehavior.Cascade); // Wenn ein Poll gelöscht wird, werden auch die Optionen gelöscht


            // Optional: Beziehung Vote -> User (Viele-zu-Eins)
            // Falls eine Navigation Property 'User' in 'Vote' existiert und 'User' eine Sammlung von 'Votes' hat:
            // modelBuilder.Entity<Vote>()
            //    .HasOne(v => v.User)
            //    .WithMany(u => u.Votes) // Annahme: User hat eine 'List<Vote> Votes' Property
            //    .HasForeignKey(v => v.UserId);
            // Falls der User keine Vote-Sammlung hat:
            // modelBuilder.Entity<Vote>()
            //    .HasOne(v => v.User)
            //    .WithMany()
            //    .HasForeignKey(v => v.UserId);
        }
    }
}