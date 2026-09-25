import os
import sys
import json
import shutil
from pathlib import Path

# Ensure root directory is on sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ats.backend.database import get_all_jobs, get_daily_application_count
from ats.backend.modules.skill_gap_analyzer import analyze_skill_gaps
from ats.backend.config import DAILY_APPLICATION_CAP, RESUMES_DIR

DOCS_DIR = PROJECT_ROOT / "docs"

def export_static_site():
    print("=" * 60)
    print("[EXPORT] Building Static GitHub Pages Site in /docs...")
    print("=" * 60)
    
    # 1. Clean / create docs directories
    data_dir = DOCS_DIR / "data"
    resumes_dir = DOCS_DIR / "resumes"
    static_dir = DOCS_DIR / "static"
    
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(parents=True, exist_ok=True)
    resumes_dir.mkdir(parents=True, exist_ok=True)
    
    # 2. Copy frontend assets
    frontend_dir = PROJECT_ROOT / "ats" / "frontend"
    shutil.copy2(frontend_dir / "index.html", DOCS_DIR / "index.html")
    
    if (frontend_dir / "static").exists():
        if static_dir.exists():
            shutil.rmtree(static_dir)
        shutil.copytree(frontend_dir / "static", static_dir)
        
    print("[1/4] Copied index.html and static assets (CSS, JS).")

    # 3. Export Data JSON
    jobs = get_all_jobs()
    ready_count = sum(1 for j in jobs if j.get("status") == "ready_for_review")
    applied_count = sum(1 for j in jobs if j.get("status") == "applied")
    interview_count = sum(1 for j in jobs if j.get("status") == "interview")
    
    # jobs.json
    with open(data_dir / "jobs.json", "w", encoding="utf-8") as f:
        json.dump({"jobs": jobs, "total": len(jobs)}, f, indent=2)
        
    # status.json
    daily_applied = get_daily_application_count()
    status_data = {
        "status": "healthy",
        "quota": {
            "allowed": daily_applied < DAILY_APPLICATION_CAP,
            "current_count": daily_applied,
            "daily_cap": DAILY_APPLICATION_CAP,
            "remaining": max(0, DAILY_APPLICATION_CAP - daily_applied)
        },
        "metrics": {
            "ready_for_review": ready_count,
            "applied_total": applied_count,
            "interviews": interview_count,
            "offers": 0
        }
    }
    with open(data_dir / "status.json", "w", encoding="utf-8") as f:
        json.dump(status_data, f, indent=2)
        
    # skill_gaps.json
    skill_gaps = analyze_skill_gaps()
    with open(data_dir / "skill_gaps.json", "w", encoding="utf-8") as f:
        json.dump({"skill_gaps": skill_gaps, "total": len(skill_gaps)}, f, indent=2)
        
    print(f"[2/4] Exported {len(jobs)} jobs, status, and skill gaps to docs/data/.")

    # 4. Copy tailored resumes (HTML & PDF)
    copied_resumes = 0
    if RESUMES_DIR.exists():
        for item in RESUMES_DIR.iterdir():
            if item.is_file() and (item.suffix in [".html", ".pdf"]):
                shutil.copy2(item, resumes_dir / item.name)
                copied_resumes += 1
                
    print(f"[3/4] Exported {copied_resumes} resume artifacts to docs/resumes/.")

    # 5. Add .nojekyll so GitHub Pages doesn't ignore files or folders
    with open(DOCS_DIR / ".nojekyll", "w", encoding="utf-8") as f:
        f.write("")
        
    print("[4/4] Added .nojekyll for GitHub Pages.")
    print("=" * 60)
    print("[SUCCESS] Static site export complete! Ready for GitHub Pages hosting.")
    print(f"Location: {DOCS_DIR}")
    print("=" * 60)

if __name__ == "__main__":
    export_static_site()
