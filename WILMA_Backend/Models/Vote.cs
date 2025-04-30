using System;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
// Ggf. using für User-Modell hinzufügen, z.B. Microsoft.AspNetCore.Identity, wenn IdentityUser verwendet wird

namespace WILMABackend.Models // Namespace vereinheitlicht
{
    public class Vote
    {
        public int Id { get; set; }

        // Fremdschlüssel und (optionale) Navigation zum User
        [Required]
        public string UserId { get; set; } = string.Empty; // Annahme: UserId ist ein String (z.B. von ASP.NET Core Identity)
        // Optional: Navigation Property zum User-Objekt, falls benötigt
        // public virtual User User { get; set; }

        // Fremdschlüssel und Navigation zum Poll
        public int PollId { get; set; }
        [JsonIgnore] // Verhindert Zirkelbezüge
        public virtual Poll Poll { get; set; } = null!;

        // Fremdschlüssel und Navigation zur PollOption
        public int PollOptionId { get; set; }
        public virtual PollOption PollOption { get; set; } = null!;

        public DateTime VotedAt { get; set; } = DateTime.UtcNow;
    }
}