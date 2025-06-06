using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt; // Für JwtRegisteredClaimNames
using System.Linq;
using System.Threading.Tasks;
using WILMABackend.Data; // Dein DbContext Namespace
using System; // Für DateTime

namespace WILMABackend.Filters // Oder dein gewünschter Namespace für Filter
{
    public class TokenBlacklistFilter : IAsyncActionFilter
    {
        private readonly WilmaContext _context;

        public TokenBlacklistFilter(WilmaContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            // Nur ausführen, wenn der Benutzer authentifiziert ist (also ein Token vorhanden ist)
            if (context.HttpContext.User.Identity?.IsAuthenticated ?? false)
            {
                var jtiClaim = context.HttpContext.User.FindFirst(JwtRegisteredClaimNames.Jti);

                if (jtiClaim != null && !string.IsNullOrEmpty(jtiClaim.Value))
                {
                    var tokenId = jtiClaim.Value;
                    var isBlacklisted = await _context.BlacklistedTokens
                        .AnyAsync(bt => bt.TokenId == tokenId && bt.ExpirationDate > DateTime.UtcNow);
                    if (isBlacklisted)
                    {
                        context.Result = new UnauthorizedObjectResult(new { message = "Token is blacklisted and no longer valid." });
                        return;
                    }
                }
            }
            await next();
        }
    }
}