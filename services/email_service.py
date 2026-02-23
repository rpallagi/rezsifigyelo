"""Email notification service for chat messages via Gmail SMTP."""
import logging
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from flask import current_app

logger = logging.getLogger(__name__)


def is_email_enabled() -> bool:
    """Check if email notifications are configured and enabled."""
    return (
        current_app.config.get('EMAIL_NOTIFICATIONS_ENABLED', False)
        and bool(current_app.config.get('SMTP_USER'))
        and bool(current_app.config.get('SMTP_PASSWORD'))
    )


def _build_html(sender_name: str, message: str, chat_url: str) -> str:
    """Build HTML email template for chat notification."""
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Rezsi Figyelő</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Új üzenet érkezett</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;color:#71717a;font-size:13px;">Feladó:</p>
              <p style="margin:0 0 20px;color:#18181b;font-size:16px;font-weight:600;">{sender_name}</p>

              <div style="background:#f4f4f5;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0;color:#27272a;font-size:14px;line-height:1.6;white-space:pre-wrap;">{message}</p>
              </div>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="{chat_url}"
                       style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:600;">
                      Megnyitás a chatben
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:0 32px 28px;border-top:1px solid #e4e4e7;">
              <p style="margin:16px 0 0;color:#a1a1aa;font-size:11px;line-height:1.5;text-align:center;">
                A nyomon követhetőség érdekében minden kommunikációt a Rezsi Figyelő chatben folytass.
                Ne válaszolj erre az emailre.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _send_email(to_email: str, subject: str, html_body: str):
    """Send email in background thread. Uses current_app config snapshot."""
    # Snapshot config before starting thread (avoids app context issues)
    from flask import current_app
    smtp_host = current_app.config.get('SMTP_HOST', 'smtp.gmail.com')
    smtp_port = current_app.config.get('SMTP_PORT', 587)
    smtp_user = current_app.config.get('SMTP_USER', '')
    smtp_password = current_app.config.get('SMTP_PASSWORD', '')
    smtp_from = current_app.config.get('SMTP_FROM', '') or smtp_user
    use_tls = current_app.config.get('SMTP_USE_TLS', True)

    def _do_send():
        try:
            msg = MIMEMultipart('alternative')
            msg['From'] = f'Rezsi Figyelő <{smtp_from}>'
            msg['To'] = to_email
            msg['Subject'] = subject
            msg.attach(MIMEText(html_body, 'html', 'utf-8'))

            if use_tls:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=30)
                server.ehlo()
                server.starttls()
            else:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30)

            server.login(smtp_user, smtp_password)
            server.send_message(msg)
            server.quit()
            logger.info(f"Email sent to {to_email}: {subject}")
        except Exception as e:
            logger.error(f"Email send failed to {to_email}: {e}")

    t = threading.Thread(target=_do_send, daemon=True)
    t.start()


def notify_tenant_of_admin_message(property_id: int, sender_name: str, message: str, base_url: str):
    """Send email to tenant(s) when admin sends a chat message."""
    if not is_email_enabled():
        return

    from models import db, Property

    # Find tenant emails linked to this property
    prop = Property.query.get(property_id)
    if not prop:
        return

    tenant_emails = []
    for tenant in prop.tenants:
        if tenant.email:
            tenant_emails.append(tenant.email)

    if not tenant_emails:
        logger.debug(f"No tenant emails for property {property_id}")
        return

    chat_url = f"{base_url}/tenant/chat"
    subject = f"Új üzenet: {prop.name} — {sender_name}"
    html = _build_html(sender_name, message, chat_url)

    for email in tenant_emails:
        _send_email(email, subject, html)


def notify_admin_of_tenant_message(property_id: int, sender_name: str, message: str, base_url: str):
    """Send email to admin when tenant sends a chat message."""
    if not is_email_enabled():
        return

    from models import Property

    admin_email = current_app.config.get('ADMIN_EMAIL', '')

    # Fallback: use property contact_email
    if not admin_email:
        prop = Property.query.get(property_id)
        if prop and prop.contact_email:
            admin_email = prop.contact_email

    if not admin_email:
        logger.debug(f"No admin email configured for property {property_id}")
        return

    prop = Property.query.get(property_id)
    prop_name = prop.name if prop else f"#{property_id}"

    chat_url = f"{base_url}/admin/properties/{property_id}?tab=chat"
    subject = f"Új üzenet: {prop_name} — {sender_name}"
    html = _build_html(sender_name, message, chat_url)

    _send_email(admin_email, subject, html)
