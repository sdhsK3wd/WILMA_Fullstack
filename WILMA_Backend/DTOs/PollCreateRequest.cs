using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace WILMABackend.DTOs // Namespace für DTOs
{
    // DTO für die Anfrage zum Erstellen eines neuen Polls
    public class PollCreateRequest
    {
        [Required(ErrorMessage = "Der Titel ist erforderlich.")]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        [Required(ErrorMessage = "Mindestens zwei Optionen sind erforderlich.")]
        [MinLength(2, ErrorMessage = "Es müssen mindestens zwei Optionen angegeben werden.")]
        public List<string> Options { get; set; } = new();

        // Optional: EndDate hinzufügen, wenn benötigt
        // public DateTime? EndDate { get; set; }
    }
}