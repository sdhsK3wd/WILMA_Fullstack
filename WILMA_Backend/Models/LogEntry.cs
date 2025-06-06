using System;

namespace WILMABackend.Models
{
    public class LogEntry
    {
        public int Id { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.Now;

        public string Level { get; set; } = "INFO";
        public string User { get; set; } = "system";
        public string Message { get; set; } = string.Empty;
        public string? DetailsJson { get; set; }
    }
}