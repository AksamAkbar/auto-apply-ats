import os
import sys
from pathlib import Path

# Configure safe utf-8 stdout encoding on Windows
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

# Ensure root directory is on sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ats.backend.config import (
    DEFAULT_NOTIFICATION_EMAIL, SMTP_HOST, SMTP_PORT,
    SMTP_USER, SMTP_PASSWORD
)
from ats.daily_digest_job import run_daily_cycle

def main():
    recipient = os.getenv("NOTIFICATION_EMAIL", "aksamakbar@gmail.com")
    run_daily_cycle(recipient=recipient)

if __name__ == "__main__":
    main()
