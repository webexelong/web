using System.Net;
using System.Net.Mail;
using System.Text;
using WebCafe.Backend.Services.Abstraction;

namespace WebCafe.Backend.Services.Implementation;

public sealed class SmtpEmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(IConfiguration configuration, ILogger<SmtpEmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendVerificationEmailAsync(string recipient, string verificationUrl, CancellationToken cancellationToken = default)
    {
        var host = _configuration["Email:SmtpHost"];
        var from = _configuration["Email:From"];
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(from))
        {
            throw new InvalidOperationException("Email SMTP chưa được cấu hình. Không thể hoàn tất đăng ký.");
        }

        var port = _configuration.GetValue<int?>("Email:SmtpPort") ?? 587;
        var enableSsl = _configuration.GetValue("Email:EnableSsl", true);
        var username = _configuration["Email:Username"] ?? from;
        var password = _configuration["Email:Password"] ?? string.Empty;

        _logger.LogInformation("Đang gửi email xác minh tới {Recipient} qua SMTP {Host}:{Port}", recipient, host, port);

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = enableSsl,
            Credentials = new NetworkCredential(username, password)
        };

        var fromAddress = new MailAddress(from, "AI-SMARTSERVE");
        var toAddress = new MailAddress(recipient);

        using var message = new MailMessage(fromAddress, toAddress)
        {
            Subject = "Xác minh tài khoản AI-SMARTSERVE (Dùng thử 14 ngày)",
            SubjectEncoding = Encoding.UTF8,
            BodyEncoding = Encoding.UTF8,
            IsBodyHtml = true,
            Body = $@"
<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f5f3; color: #33261d; margin: 0; padding: 24px; }}
    .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #ebdcd0; padding: 36px 32px; box-shadow: 0 4px 20px rgba(85,55,36,0.06); }}
    .logo {{ font-size: 24px; font-weight: 900; color: #e5601a; letter-spacing: -0.5px; margin-bottom: 24px; }}
    h1 {{ font-size: 22px; color: #2e2017; margin: 0 0 16px; font-weight: 800; }}
    p {{ font-size: 15px; line-height: 1.6; color: #5c4738; margin: 0 0 16px; }}
    .btn {{ display: inline-block; background-color: #e5601a; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 700; font-size: 15px; margin: 16px 0 24px; text-align: center; }}
    .url-box {{ background: #faf8f6; border: 1px dashed #decbc0; border-radius: 8px; padding: 12px; font-size: 12px; word-break: break-all; color: #7d6859; line-height: 1.4; }}
    .footer {{ margin-top: 32px; padding-top: 20px; border-top: 1px solid #f0e6df; font-size: 12px; color: #9c8a7d; text-align: center; }}
  </style>
</head>
<body>
  <div class='container'>
    <div class='logo'>☕ AI-SMARTSERVE</div>
    <h1>Chào mừng bạn đến với AI-SMARTSERVE!</h1>
    <p>Cảm ơn bạn đã đăng ký tài khoản trải nghiệm nền tảng quản trị quán thông minh. Vui lòng bấm vào nút bên dưới để xác minh email và kích hoạt ngay <strong>14 ngày dùng thử miễn phí</strong>:</p>
    <div>
      <a href='{verificationUrl}' class='btn' target='_blank'>Xác minh email ngay</a>
    </div>
    <p>Nếu nút bấm trên không hoạt động, bạn có thể copy và dán trực tiếp liên kết sau vào trình duyệt:</p>
    <div class='url-box'>{verificationUrl}</div>
    <p style='margin-top: 20px; font-size: 13px; color: #8a7364;'>* Liên kết xác minh này có hiệu lực trong vòng <strong>24 giờ</strong>.</p>
    <div class='footer'>
      © {DateTime.UtcNow.Year} AI-SMARTSERVE. Nền tảng quản lý quán F&B thông minh. Mọi thắc mắc vui lòng liên hệ support@ai-smartserve.io.vn.
    </div>
  </div>
</body>
</html>"
        };

        await client.SendMailAsync(message, cancellationToken);
        _logger.LogInformation("Gửi email xác minh thành công tới {Recipient}", recipient);
    }
}

