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
from ats.backend.database import init_db, get_all_jobs
from ats.backend.modules.searcher import search_and_process_jobs
from ats.backend.modules.email_notifier import get_top_24_daily_jobs, send_daily_digest

def main():
    print("=" * 65)
    print("[CLOUD RUN] GITHUB ACTIONS: 9:00 AM DAILY JOB DIGEST DISPATCH")
    print("=" * 65)
    
    # 1. Initialize DB
    init_db()
    
    # 2. Check or scan jobs
    jobs = get_all_jobs()
    if len(jobs) < 24:
        print("[1/3] Running automated job search & ATS tailoring for fresh openings...")
        jobs = search_and_process_jobs(max_results=32)
        print(f"      Curated {len(jobs)} active openings.")
    else:
        print(f"[1/3] Found {len(jobs)} curated openings in database.")

    # 3. Get top 24 jobs
    top_24 = get_top_24_daily_jobs()
    print(f"[2/3] Selected top {len(top_24)} openings across all platforms:")
    sources = set(j.get("source") for j in top_24)
    print(f"      Platforms included: {', '.join(sources)}")
    
    # 4. Dispatch Email
    recipient = os.getenv("NOTIFICATION_EMAIL", DEFAULT_NOTIFICATION_EMAIL)
    print(f"[3/3] Compiling and dispatching 9:00 AM digest to: {recipient}...")
    
    result = send_daily_digest(recipient=recipient, jobs=top_24)
    print(f"      Status: {result.get('status')}")
    print(f"      Message: {result.get('message')}")
    
    if result.get("smtp_configured"):
        print("[SUCCESS] Email digest dispatched to your inbox!")
    else:
        print("[NOTICE] Email digest generated and saved. (Set SMTP_USER & SMTP_PASSWORD in GitHub Secrets for live inbox delivery).")
    print("=" * 65)

if __name__ == "__main__":
    main()
