import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from .config import BASE_DIR, RESUMES_DIR, DAILY_APPLICATION_CAP
from .database import (
    init_db, get_all_jobs, get_job, update_job_status,
    get_daily_application_count
)
from .modules.searcher import search_and_process_jobs
from .modules.applicator import (
    check_can_apply_today, launch_copilot_application,
    confirm_application_submission, answer_screening_question, generate_cover_message
)
from .modules.skill_gap_analyzer import analyze_skill_gaps
from .modules.email_notifier import send_daily_digest, get_top_24_daily_jobs, generate_daily_digest_html

app = FastAPI(title="AutoApply ATS - Automated Job Application & Resume Tailoring System")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = BASE_DIR / "frontend"

@app.on_event("startup")
def startup_event():
    init_db()

# --- API Endpoints ---

@app.get("/api/status")
def get_system_status():
    quota = check_can_apply_today()
    all_jobs = get_all_jobs()
    ready_count = sum(1 for j in all_jobs if j.get("status") in ["ready_for_review", "tailored"])
    applied_count = sum(1 for j in all_jobs if j.get("status") == "applied")
    interview_count = sum(1 for j in all_jobs if j.get("status") == "interview")
    
    return {
        "quota": quota,
        "metrics": {
            "total_discovered": len(all_jobs),
            "ready_for_review": ready_count,
            "applied_total": applied_count,
            "interviews": interview_count,
            "daily_cap": DAILY_APPLICATION_CAP,
            "applied_today": quota["current_count"]
        }
    }

@app.get("/api/jobs")
def list_jobs(status: Optional[str] = None):
    jobs = get_all_jobs(status_filter=status)
    return {"jobs": jobs, "total": len(jobs)}

@app.get("/api/jobs/{job_id}")
def get_single_job(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    cover_letter = generate_cover_message(job)
    return {"job": job, "cover_letter": cover_letter}

@app.post("/api/search")
def trigger_job_search(limit: int = 15):
    """Discovers openings, filters by <=7 days & 0-2 YOE, filters ATS >=70%, and auto-tailors to 90%+"""
    results = search_and_process_jobs(max_results=limit)
    return {
        "discovered_count": len(results),
        "jobs": results,
        "message": f"Successfully processed {len(results)} high-relevance openings with 90%+ tailored resumes!"
    }

class ApplyRequest(BaseModel):
    notes: Optional[str] = "Launching Copilot Application"

@app.post("/api/jobs/{job_id}/apply")
def apply_to_job(job_id: str, payload: ApplyRequest = None):
    result = launch_copilot_application(job_id)
    if not result["success"]:
        raise HTTPException(status_code=429, detail=result["message"])
    return result

class ConfirmApplyRequest(BaseModel):
    notes: Optional[str] = "Confirmed submitted via Copilot"

@app.post("/api/jobs/{job_id}/confirm-applied")
def confirm_applied(job_id: str, payload: ConfirmApplyRequest = None):
    notes = payload.notes if payload else "Confirmed submitted via Copilot"
    result = confirm_application_submission(job_id, notes=notes)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

class QuestionRequest(BaseModel):
    question: str
    job_id: str

@app.post("/api/copilot/answer-question")
def get_question_answer(payload: QuestionRequest):
    job = get_job(payload.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    answer = answer_screening_question(payload.question, job)
    return {"question": payload.question, "answer": answer}

class StatusUpdateRequest(BaseModel):
    status: str
    notes: Optional[str] = None

@app.post("/api/jobs/{job_id}/status")
def update_status(job_id: str, payload: StatusUpdateRequest):
    valid_statuses = ["discovered", "ready_for_review", "applied", "interview", "offer", "rejected"]
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
    success = update_job_status(job_id, payload.status, notes=payload.notes)
    return {"success": success, "job_id": job_id, "new_status": payload.status}

@app.get("/api/resumes/{filename}")
def serve_resume(filename: str, download: bool = False):
    file_path = RESUMES_DIR / filename
    if not file_path.exists():
        # Check if requested .pdf but .html exists
        if filename.endswith(".pdf"):
            alt_html = RESUMES_DIR / filename.replace(".pdf", ".html")
            if alt_html.exists():
                file_path = alt_html
        elif filename.endswith(".html"):
            alt_pdf = RESUMES_DIR / filename.replace(".html", ".pdf")
            if alt_pdf.exists():
                file_path = alt_pdf
                
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Resume file not found")
        
    media_type = "application/pdf" if file_path.name.endswith(".pdf") else "text/html"
    disposition = "attachment" if download else "inline"
    return FileResponse(
        file_path,
        media_type=media_type,
        filename=file_path.name,
        content_disposition_type=disposition
    )

@app.get("/api/skill-gaps")
def list_skill_gaps():
    gaps = analyze_skill_gaps()
    return {"skill_gaps": gaps, "total": len(gaps)}

class ToggleSkillRequest(BaseModel):
    is_completed: bool

@app.post("/api/skill-gaps/{skill_name}/toggle")
def toggle_skill(skill_name: str, payload: ToggleSkillRequest):
    from .database import toggle_skill_completion
    success = toggle_skill_completion(skill_name, payload.is_completed)
    return {"success": success, "skill_name": skill_name, "is_completed": payload.is_completed}

class DigestRequest(BaseModel):
    recipient: Optional[str] = "aksamakbar@gmail.com"

@app.post("/api/send-digest")
def trigger_send_digest(payload: Optional[DigestRequest] = None):
    recipient = payload.recipient if payload and payload.recipient else "aksamakbar@gmail.com"
    result = send_daily_digest(recipient=recipient)
    return result

@app.get("/api/digests/preview")
def preview_latest_digest(recipient: Optional[str] = "aksamakbar@gmail.com"):
    jobs = get_top_24_daily_jobs()
    html_content = generate_daily_digest_html(jobs, recipient=recipient)
    return HTMLResponse(content=html_content, status_code=200)

# --- Static Frontend Serving ---
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR / "static")), name="static")

@app.get("/")
def serve_index():
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return HTMLResponse("<h1>AutoApply ATS Backend Running</h1><p>Frontend index.html is being prepared.</p>")
