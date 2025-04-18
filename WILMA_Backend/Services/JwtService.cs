// using System.IdentityModel.Tokens.Jwt;
// using System.Security.Claims;
// using System.Text;
// using Microsoft.IdentityModel.Tokens;
//
// public class JwtService
// {
//     private readonly string _key;
//     private readonly string _issuer;
//     private readonly string _audience;
//
//     public JwtService(string key, string issuer, string audience)
//     {
//         _key = key;
//         _issuer = issuer;
//         _audience = audience;
//     }
//
//     public string GenerateToken(string email)
//     {
//         var tokenDescriptor = new SecurityTokenDescriptor
//         {
//             Subject = new ClaimsIdentity(new[]
//             {
//                 new Claim(ClaimTypes.Email, email)
//             }),
//             Expires = DateTime.UtcNow.AddHours(1),
//             SigningCredentials = new SigningCredentials(
//                 new SymmetricSecurityKey(Encoding.ASCII.GetBytes(_key)),
//                 SecurityAlgorithms.HmacSha256Signature
//             ),
//             Issuer = _issuer,
//             Audience = _audience
//         };
//
//         var tokenHandler = new JwtSecurityTokenHandler();
//         var token = tokenHandler.CreateToken(tokenDescriptor);
//         return tokenHandler.WriteToken(token);
//     }
// }