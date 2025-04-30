using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace WILMABackend.Models // Namespace vereinheitlicht
{
    public class PollOption
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Text { get; set; } = string.Empty;

        // Foreign Key für Poll
        public int PollId { get; set; }

        // Navigation Property zu Poll
        [JsonIgnore] // Verhindert Zirkelbezüge bei der Serialisierung
        public virtual Poll Poll { get; set; } = null!; // = null!; weist den Compiler an, keine Null-Warnung auszugeben
        // Sicherstellen, dass dies immer gesetzt wird, wenn ein PollOption-Objekt gültig ist.
    }
}