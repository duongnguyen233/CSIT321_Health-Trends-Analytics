"""
Email service for sending verification emails.
Falls back to console logging when SMTP is not configured.
"""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import settings

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return bool(settings.SMTP_USER and settings.SMTP_PASSWORD)


def send_verification_email(to_email: str, token: str, first_name: str = ""):
    """Send a verification email with a link. Falls back to console if SMTP not configured."""
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    name = first_name or "there"

    subject = "Verify your CareData Portal account"
    html_body = f"""
    <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #111; font-size: 22px; margin: 0;">CareData Portal</h1>
      </div>
      <p style="color: #333; font-size: 15px;">Hi {name},</p>
      <p style="color: #555; font-size: 14px; line-height: 1.6;">
        Thanks for creating your account. Please verify your email address by clicking the button below:
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="{verify_url}"
           style="display: inline-block; background: #ff7b00; color: #fff; text-decoration: none;
                  font-weight: 600; font-size: 15px; padding: 12px 32px; border-radius: 6px;">
          Verify Email
        </a>
      </div>
      <p style="color: #888; font-size: 12px; line-height: 1.5;">
        Or copy and paste this link into your browser:<br/>
        <a href="{verify_url}" style="color: #ff7b00; word-break: break-all;">{verify_url}</a>
      </p>
      <p style="color: #888; font-size: 12px;">This link expires in 24 hours.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #aaa; font-size: 11px; text-align: center;">
        If you didn't create an account, you can safely ignore this email.
      </p>
    </div>
    """

    if _smtp_configured():
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
            msg["To"] = to_email
            msg.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(msg["From"], [to_email], msg.as_string())
            logger.info("Verification email sent to %s", to_email)
        except Exception as e:
            logger.error("Failed to send verification email to %s: %s", to_email, e)
            # Fall through to console output so dev flow isn't blocked
            _log_to_console(to_email, verify_url)
    else:
        _log_to_console(to_email, verify_url)


def _log_to_console(to_email: str, verify_url: str):
    """Log verification link to console (dev mode)."""
    logger.info(
        "\n"
        "╔══════════════════════════════════════════════════════════╗\n"
        "║  EMAIL VERIFICATION (SMTP not configured — dev mode)    ║\n"
        "╠══════════════════════════════════════════════════════════╣\n"
        "║  To: %-49s ║\n"
        "║  Link: %-47s ║\n"
        "╚══════════════════════════════════════════════════════════╝",
        to_email, verify_url,
    )
    print(f"\n=> VERIFICATION LINK for {to_email}:\n   {verify_url}\n")
