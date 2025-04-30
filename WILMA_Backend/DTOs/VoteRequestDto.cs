using System.ComponentModel.DataAnnotations;

namespace WILMABackend.DTOs // Namespace für DTOs
{
    // DTO für die Anfrage zum Abstimmen
    public class VoteRequestDto
    {
        [Required(ErrorMessage = "Die ID der Abstimmungsoption ist erforderlich.")]
        public int OptionId { get; set; }
    }
}