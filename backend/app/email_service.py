"""SMTP email service — wraps stdlib smtplib in a thread pool so FastAPI stays async."""
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from starlette.concurrency import run_in_threadpool

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", f"WIMARC <{SMTP_USERNAME}>")


def _send_sync(to_email: str, subject: str, html_body: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = EMAIL_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
        smtp.starttls()
        smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
        smtp.sendmail(SMTP_USERNAME, [to_email], msg.as_string())


async def send_otp_email(to_email: str, otp: str, name: str = "") -> None:
    greeting = f"สวัสดีคุณ {name}," if name else "สวัสดี,"
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#1a1a1a;margin:0 0 8px">WIMARC API Portal</h2>
      <p style="color:#555;margin:0 0 24px">{greeting}</p>
      <p style="color:#333;margin:0 0 16px">รหัส OTP สำหรับเข้าสู่ระบบของคุณคือ:</p>
      <div style="background:#f4f4f5;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px">
        <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#1a1a1a;font-family:monospace">{otp}</span>
      </div>
      <p style="color:#888;font-size:13px;margin:0">รหัสนี้มีอายุ <strong>15 นาที</strong> และใช้ได้ครั้งเดียวเท่านั้น</p>
      <p style="color:#888;font-size:13px;margin:8px 0 0">หากคุณไม่ได้ขอรหัสนี้ กรุณาเพิกเฉยต่ออีเมลนี้</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#aaa;font-size:12px;margin:0">WIMARC Weather Monitoring &amp; Remote Control</p>
    </div>
    """
    await run_in_threadpool(_send_sync, to_email, "รหัส OTP เข้าสู่ระบบ WIMARC API Portal", html)


def is_email_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USERNAME and SMTP_PASSWORD)
