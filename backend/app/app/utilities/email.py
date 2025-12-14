import logging
from pathlib import Path
from typing import Any, Dict

import emails
from emails.template import JinjaTemplate

from app.core.config import settings
from app.schemas import EmailContent


def send_email(
    email_to: str,
    subject_template: str = "",
    html_template: str = "",
    environment: Dict[str, Any] = {},
) -> None:
    assert settings.EMAILS_ENABLED, "no provided configuration for email variables"
    message = emails.Message(
        subject=JinjaTemplate(subject_template),
        html=JinjaTemplate(html_template),
        mail_from=(settings.EMAILS_FROM_NAME, settings.EMAILS_FROM_EMAIL),
    )
    smtp_options = {"host": settings.SMTP_HOST, "port": settings.SMTP_PORT}
    if settings.SMTP_TLS:
        # https://python-emails.readthedocs.io/en/latest/
        smtp_options["ssl"] = True
    if settings.SMTP_USER:
        smtp_options["user"] = settings.SMTP_USER
    if settings.SMTP_PASSWORD:
        smtp_options["password"] = settings.SMTP_PASSWORD
    # Add common template environment elements
    environment["server_host"] = settings.SERVER_HOST
    environment["server_name"] = settings.SERVER_NAME
    environment["server_bot"] = settings.SERVER_BOT
    response = message.send(to=email_to, render=environment, smtp=smtp_options)
    logging.info(f"send email result: {response}")


def send_web_contact_email(data: EmailContent) -> None:
    subject = f"{settings.PROJECT_NAME} - {data.subject}"
    with open(Path(settings.EMAIL_TEMPLATES_DIR) / "web_contact_email.html") as f:
        template_str = f.read()
    send_email(
        email_to=settings.EMAILS_TO_EMAIL,
        subject_template=subject,
        html_template=template_str,
        environment={"content": data.content, "email": data.email},
    )


def send_test_email(email_to: str) -> None:
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - Test email"
    with open(Path(settings.EMAIL_TEMPLATES_DIR) / "test_email.html") as f:
        template_str = f.read()
    send_email(
        email_to=email_to,
        subject_template=subject,
        html_template=template_str,
        environment={"project_name": settings.PROJECT_NAME, "email": email_to},
    )

