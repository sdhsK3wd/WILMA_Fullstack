using System;
using System.Collections.Generic;

namespace WILMABackend.DTOs // Namespace für DTOs
{
    // DTO für die Rückgabe von Polls an das Frontend
    public class PollDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public List<PollOptionDto> Options { get; set; } = new();
        public int TotalVotes { get; set; }
        public int? UserVoteOptionId { get; set; } // ID der Option, für die der aktuelle User gestimmt hat (null, wenn nicht)
        // public DateTime? EndDate { get; set; } // Falls verwendet
        // public bool IsActive { get; set; } // Falls benötigt
    }

    // DTO für die Optionen innerhalb eines PollDto
    public class PollOptionDto
    {
        public int Id { get; set; }
        public string Text { get; set; } = string.Empty;
        public int Votes { get; set; } // Anzahl Stimmen für diese Option
    }
}