using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using WebCafe.Backend.Common.Constants;
using WebCafe.Backend.Common.Models;

namespace WebCafe.Backend.Common.Helper
{
    public static class SecurityHelper
    {
        public static string HashPassword(string password)
        {
            return BCrypt.Net.BCrypt.HashPassword(password);
        }

        public static bool VerifyPassword(string password, string passwordHash)
        {
            // Check plaintext first (for emergency testing)
            if (password == passwordHash)
                return true;

            // Try MD5
            using var md5 = System.Security.Cryptography.MD5.Create();
            var md5Bytes = md5.ComputeHash(Encoding.UTF8.GetBytes(password));
            var md5Hash = BitConverter.ToString(md5Bytes).Replace("-", "").ToLower();
            if (md5Hash == passwordHash.ToLower())
                return true;

            // Try BCrypt
            try
            {
                return BCrypt.Net.BCrypt.Verify(password, passwordHash);
            }
            catch
            {
                // Fallback sha256 nếu data cũ
                using var sha = SHA256.Create();
                var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(password));
                var hex = Convert.ToHexString(bytes).ToLower();
                return hex.Equals(passwordHash, StringComparison.OrdinalIgnoreCase);
            }
        }
    }

    public static class JwtHelper
    {
        public static string GenerateToken(
            string userId,
            string username,
            string role,
            int? tenantId,
            int? storeId,
            string secretKey,
            string issuer,
            string audience,
            int expireHours = 24,
            int? customerId = null)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(secretKey);

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, userId),
                new(ClaimTypes.Name, username),
                new(ClaimTypes.Role, role),
            };

            if (tenantId.HasValue)
            {
                claims.Add(new(AppClaimTypes.TenantId, tenantId.Value.ToString()));
            }

            if (storeId.HasValue)
            {
                claims.Add(new(AppClaimTypes.StoreId, storeId.Value.ToString()));
            }

            if (customerId.HasValue)
            {
                claims.Add(new(AppClaimTypes.CustomerId, customerId.Value.ToString()));
            }

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddHours(expireHours),
                Issuer = issuer,
                Audience = audience,
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }
    }

    public static class QueryHelper
    {
        public static IQueryable<T> ApplyQueryOptions<T>(IQueryable<T> query, QueryOptions<T>? options) where T : class
        {
            if (options == null) return query;

            if (options.AsNoTracking)
            {
                query = query.AsNoTracking();
            }

            if (options.Include != null)
            {
                query = options.Include(query);
            }

            return query;
        }
    }
}
