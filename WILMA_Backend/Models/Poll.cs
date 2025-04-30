using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using WILMA_Backend.Models;

namespace WILMABackend.Models // Namespace vereinheitlicht
{
    public class Poll
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        [Required]
        public string CreatedBy { get; set; } = string.Empty; // Oder Verknüpfung zum User-Objekt

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Optional: Enddatum für die Abstimmung
        // public DateTime? EndDate { get; set; }

        // Navigation Properties
        public virtual List<PollOption> Options { get; set; } = new();
        public virtual List<Vote> Votes { get; set; } = new();
    }
}