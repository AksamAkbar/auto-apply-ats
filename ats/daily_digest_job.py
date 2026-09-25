import os
import sys
from pathlib import Path

# Configure utf-8 encoding safely for Windows consoles
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

# Ensure root directory is on sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ats.backend.database import init_db, get_all_jobs
from ats.backend.modules.searcher import search_and_process_jobs
from ats.backend.modules.email_notifier import send_daily_digest, get_top_24_daily_jobs
from ats.export_static import export_static_site

def run_daily_cycle(recipient: str = "aksamakbar@gmail.com"):
    print("=" * 65)
    print("[DAILY SCAN] AUTOAPPLY ATS: DAILY 9 AM SCAN & REFRESH CYCLE")
    print("=" * 65)
    
    # 1. Initialize DB
    print("[1/4] Connecting to application database...")
    init_db()

    # 2. Discover, filter, and score new openings
    print("[2/4] Scanning fresh openings across platforms (Indeed, LinkedIn, Greenhouse, Portals)...")
    new_jobs = search_and_process_jobs(max_results=35)
    print(f"      Scanned and evaluated {len(new_jobs)} openings (Fresher-2 YOE, 90%+ ATS).")

    # 3. Compile top 24 daily openings and generate digest
    print("[3/4] Compiling top 24 openings sorted by priority (Bengaluru -> Kerala -> Metros -> GCC)...")
    top_jobs = get_top_24_daily_jobs()
    print(f"      Selected top {len(top_jobs)} prioritized openings.")
    
    # Dispatch or save digest
    digest_result = send_daily_digest(recipient=recipient, jobs=top_jobs)
    print(f"      Digest Status: {digest_result.get('status')}")
    print(f"      Message: {digest_result.get('message')}")
    print(f"      Artifact HTML: {digest_result.get('html_path')}")
    print(f"      Artifact TXT:  {digest_result.get('text_path')}")

    # 4. Re-export static site to /docs so GitHub Pages is up-to-date
    print("[4/4] Updating GitHub Pages deployment in /docs...")
    export_static_site()

    print("=" * 65)
    print("[SUCCESS] Daily cycle complete! All 24 curated openings are refreshed.")
    print("=" * 65)
    return digest_result

if __name__ == "__main__":
    run_daily_cycle()
