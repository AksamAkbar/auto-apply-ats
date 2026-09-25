import sys
import os
import webbrowser
import time
from pathlib import Path

# Configure utf-8 encoding safely for Windows consoles
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

# Add ats directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR.parent))

from ats.backend.database import init_db, get_all_jobs
from ats.backend.modules.searcher import search_and_process_jobs
import uvicorn

def main():
    print("=" * 60)
    print("[STARTING] AutoApply ATS Platform for Aksam Akbar")
    print("=" * 60)
    
    # 1. Initialize SQLite Database
    print("[1/3] Initializing application database...")
    init_db()

    # 2. Check existing jobs, if empty run initial scan & tailoring
    jobs = get_all_jobs()
    if not jobs:
        print("[2/3] Performing initial job discovery and 90%+ ATS resume tailoring...")
        try:
            initial_jobs = search_and_process_jobs(max_results=12)
            print(f"      Discovered and tailored {len(initial_jobs)} openings.")
        except Exception as e:
            print(f"      Warning during initial search: {e}")
    else:
        print(f"[2/3] Loaded {len(jobs)} jobs from database.")

    import socket
    local_ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    # 3. Launch Web Dashboard
    dashboard_url = "http://localhost:8000"
    mobile_url = f"http://{local_ip}:8000"
    print(f"[3/3] Web server ready!")
    print("=" * 60)
    print(f"💻 Desktop Access: {dashboard_url}")
    print(f"📱 Phone Access:   {mobile_url} (on same Wi-Fi)")
    print("=" * 60)

    # Open browser automatically after short delay
    def open_browser():
        time.sleep(1.2)
        try:
            webbrowser.open(dashboard_url)
        except Exception:
            pass

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    uvicorn.run("ats.backend.main:app", host="0.0.0.0", port=8000, reload=False)

if __name__ == "__main__":
    main()
