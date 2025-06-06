

using System.ComponentModel.DataAnnotations;

namespace WILMABackend.Models // Oder dein entsprechender Namespace für Models
{
    public class BlacklistedToken
    {
        [Key]
        public string TokenId { get; set; } // Wird der jti-Claim sein

        public DateTime ExpirationDate { get; set; } // Wann der Token ursprünglich abläuft
    }
}