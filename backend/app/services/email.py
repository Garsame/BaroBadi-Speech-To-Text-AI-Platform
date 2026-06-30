import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from datetime import datetime
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

def send_otp_email(to_email: str, otp_code: str) -> bool:
    subject = f"Verification Code: {otp_code}"
    
    current_year = datetime.utcnow().year
    body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #121a2d; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #2a2a72; margin-bottom: 5px; font-size: 24px;">Baro Platform</h2>
          <p style="color: #65728a; font-size: 0.95rem; margin-top: 0;">Verify Your Email Address</p>
        </div>
        <div style="background: #f1f5fb; border-radius: 16px; padding: 30px; text-align: center; border: 1px solid #e3e8f2; box-shadow: 0 4px 12px rgba(42, 42, 114, 0.03);">
          <p style="margin-top: 0; font-size: 1.05rem; color: #121a2d; font-weight: 500;">Use the following One-Time Password (OTP) to verify your email address:</p>
          <div style="font-size: 2.4rem; font-weight: 850; letter-spacing: 6px; color: #2a2a72; margin: 24px 0; padding: 12px 24px; background: #ffffff; border-radius: 12px; display: inline-block; border: 1px solid #e3e8f2; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            {otp_code}
          </div>
          <p style="font-size: 0.85rem; color: #65728a; margin-bottom: 0; line-height: 1.4;">This code will expire in 15 minutes.<br>If you did not request this verification, you can safely ignore this email.</p>
        </div>
        <div style="text-align: center; margin-top: 30px; font-size: 0.8rem; color: #65728a; border-top: 1px solid #e3e8f2; padding-top: 15px;">
          © {current_year} Baro Platform. All rights reserved.
        </div>
      </body>
    </html>
    """

    # Check if SMTP is configured
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured. MOCK EMAIL SENT. to_email=%s otp_code=%s", to_email, otp_code)
        print("\n" + "="*80)
        print(f"MOCK EMAIL DISPATCH TO: {to_email}")
        print(f"OTP CODE: {otp_code}")
        print("="*80 + "\n")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL or settings.SMTP_USER}>"
        msg["To"] = to_email

        html_part = MIMEText(body, "html")
        msg.attach(html_part)

        # Connect to SMTP Server
        server_class = smtplib.SMTP_SSL if settings.SMTP_PORT == 465 else smtplib.SMTP
        server = server_class(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        
        if settings.SMTP_PORT != 465 and settings.SMTP_TLS:
            server.starttls()
            
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(msg["From"], [to_email], msg.as_string())
        server.quit()
        logger.info("Real email successfully sent. to_email=%s", to_email)
        return True
    except Exception as e:
        logger.error("Failed to send SMTP email to %s: %s. Falling back to mock output.", to_email, str(e))
        print("\n" + "="*80)
        print(f"FALLBACK MOCK EMAIL DISPATCH TO: {to_email}")
        print(f"OTP CODE: {otp_code}")
        print(f"ERROR: {str(e)}")
        print("="*80 + "\n")
        return False

def send_contact_message_email(name: str, email: str, topic: str, message: str) -> bool:
    subject = f"New Contact Message: {topic} (from {name})"
    
    current_year = datetime.utcnow().year
    body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #121a2d; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #2a2a72; margin-bottom: 5px; font-size: 24px;">Baro Platform</h2>
          <p style="color: #65728a; font-size: 0.95rem; margin-top: 0;">New User Contact Inquiry</p>
        </div>
        <div style="background: #ffffff; border-radius: 16px; padding: 30px; border: 1px solid #e3e8f2; box-shadow: 0 4px 12px rgba(42, 42, 114, 0.03);">
          <h3 style="color: #2a2a72; border-bottom: 2px solid #f1f5fb; padding-bottom: 10px; margin-top: 0;">Message Details</h3>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #65728a; width: 120px;">Sender Name:</td>
              <td style="padding: 8px 0; color: #121a2d;">{name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #65728a;">Sender Email:</td>
              <td style="padding: 8px 0; color: #121a2d;"><a href="mailto:{email}" style="color: #009ffd; text-decoration: none;">{email}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #65728a;">Topic:</td>
              <td style="padding: 8px 0; color: #121a2d; font-weight: 500;">{topic}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #65728a;">Received At:</td>
              <td style="padding: 8px 0; color: #121a2d;">{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</td>
            </tr>
          </table>

          <div style="background: #f1f5fb; border-radius: 12px; padding: 20px; border: 1px solid #e3e8f2; margin-top: 20px;">
            <p style="margin-top: 0; font-weight: bold; color: #2a2a72; font-size: 0.95rem;">Message Content:</p>
            <p style="margin-bottom: 0; color: #121a2d; white-space: pre-wrap; font-style: italic;">"{message}"</p>
          </div>
          
          <div style="text-align: center; margin-top: 25px;">
            <a href="http://localhost:3000/admin/messages" style="background: #2a2a72; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 0.9rem;">View in Admin Panel</a>
          </div>
        </div>
        <div style="text-align: center; margin-top: 30px; font-size: 0.8rem; color: #65728a; border-top: 1px solid #e3e8f2; padding-top: 15px;">
          © {current_year} Baro Platform. All rights reserved.
        </div>
      </body>
    </html>
    """

    recipients = ["hello@baroplatform.ai"]
    configured_receiver = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    if configured_receiver and configured_receiver not in recipients:
        recipients.append(configured_receiver)

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured. MOCK EMAIL SENT. recipients=%s name=%s email=%s topic=%s", recipients, name, email, topic)
        print("\n" + "="*80)
        print(f"MOCK EMAIL DISPATCH TO: {', '.join(recipients)}")
        print(f"SENDER: {name} <{email}>")
        print(f"TOPIC: {topic}")
        print(f"MESSAGE: {message}")
        print("="*80 + "\n")
        return True

    try:
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        import smtplib

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL or settings.SMTP_USER}>"
        msg["To"] = ", ".join(recipients)

        html_part = MIMEText(body, "html")
        msg.attach(html_part)

        server_class = smtplib.SMTP_SSL if settings.SMTP_PORT == 465 else smtplib.SMTP
        server = server_class(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        
        if settings.SMTP_PORT != 465 and settings.SMTP_TLS:
            server.starttls()
            
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(msg["From"], recipients, msg.as_string())
        server.quit()
        logger.info("Real contact email successfully sent to recipients: %s", recipients)
        return True
    except Exception as e:
        logger.error("Failed to send SMTP email to recipients %s: %s. Falling back to mock output.", recipients, str(e))
        print("\n" + "="*80)
        print(f"FALLBACK MOCK EMAIL DISPATCH TO: {', '.join(recipients)}")
        print(f"SENDER: {name} <{email}>")
        print(f"TOPIC: {topic}")
        print(f"MESSAGE: {message}")
        print(f"ERROR: {str(e)}")
        print("="*80 + "\n")
        return False


def send_contact_reply_email(to_email: str, name: str, topic: str, original_message: str, reply_message: str) -> bool:
    subject = f"Re: {topic} - Baro Platform Support"
    
    current_year = datetime.utcnow().year
    body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #121a2d; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #2a2a72; margin-bottom: 5px; font-size: 24px;">Baro Platform</h2>
          <p style="color: #65728a; font-size: 0.95rem; margin-top: 0;">Support & Contact Reply</p>
        </div>
        <div style="background: #ffffff; border-radius: 16px; padding: 30px; border: 1px solid #e3e8f2; box-shadow: 0 4px 12px rgba(42, 42, 114, 0.03);">
          <p style="margin-top: 0; font-size: 1.1rem; color: #121a2d;">Hi <strong>{name}</strong>,</p>
          <p style="color: #121a2d;">Our support team has reviewed your inquiry regarding <strong>"{topic}"</strong> and responded:</p>
          
          <div style="background: #f1f5fb; border-left: 4px solid #2a2a72; border-radius: 4px 12px 12px 4px; padding: 20px; border: 1px solid #e3e8f2; margin: 20px 0;">
            <p style="margin-top: 0; font-weight: bold; color: #2a2a72; font-size: 0.95rem;">Admin Response:</p>
            <p style="margin-bottom: 0; color: #121a2d; white-space: pre-wrap;">{reply_message}</p>
          </div>
          
          <hr style="border: 0; border-top: 1px solid #e3e8f2; margin: 25px 0;">
          
          <p style="color: #65728a; font-size: 0.9rem; margin-bottom: 10px;">For reference, your original message was:</p>
          <div style="background: #fafafa; border-radius: 8px; padding: 15px; border: 1px solid #e3e8f2; font-style: italic; color: #555555; white-space: pre-wrap; font-size: 0.9rem;">
            "{original_message}"
          </div>
        </div>
        <div style="text-align: center; margin-top: 30px; font-size: 0.8rem; color: #65728a; border-top: 1px solid #e3e8f2; padding-top: 15px;">
          © {current_year} Baro Platform. All rights reserved.
        </div>
      </body>
    </html>
    """

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured. MOCK EMAIL SENT. to_email=%s name=%s topic=%s", to_email, name, topic)
        print("\n" + "="*80)
        print(f"MOCK EMAIL DISPATCH TO: {to_email}")
        print(f"SUBJECT: {subject}")
        print(f"REPLY CONTENT:\n{reply_message}")
        print("="*80 + "\n")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL or settings.SMTP_USER}>"
        msg["To"] = to_email

        html_part = MIMEText(body, "html")
        msg.attach(html_part)

        server_class = smtplib.SMTP_SSL if settings.SMTP_PORT == 465 else smtplib.SMTP
        server = server_class(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        
        if settings.SMTP_PORT != 465 and settings.SMTP_TLS:
            server.starttls()
            
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(msg["From"], [to_email], msg.as_string())
        server.quit()
        logger.info("Real contact reply email successfully sent to %s", to_email)
        return True
    except Exception as e:
        logger.error("Failed to send SMTP reply email to %s: %s. Falling back to mock output.", to_email, str(e))
        print("\n" + "="*80)
        print(f"FALLBACK MOCK EMAIL DISPATCH TO: {to_email}")
        print(f"SUBJECT: {subject}")
        print(f"REPLY CONTENT:\n{reply_message}")
        print(f"ERROR: {str(e)}")
        print("="*80 + "\n")
        return False

