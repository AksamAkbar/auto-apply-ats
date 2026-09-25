import subprocess
import os
from pathlib import Path
from jinja2 import Template
from ..config import TEMPLATE_PATH, RESUMES_DIR

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

def get_browser_exe() -> str:
    # Prefer Chrome if available, otherwise Edge
    if os.path.exists(CHROME_PATH):
        return CHROME_PATH
    if os.path.exists(EDGE_PATH):
        return EDGE_PATH
    return ""

def render_resume_to_html(profile_data: dict, output_html_path: Path) -> str:
    with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
        template_str = f.read()
    
    template = Template(template_str)
    rendered_html = template.render(profile=profile_data)
    
    with open(output_html_path, "w", encoding="utf-8") as f:
        f.write(rendered_html)
        
    return rendered_html

def generate_ats_pdf(job_id: str, profile_data: dict) -> dict:
    RESUMES_DIR.mkdir(parents=True, exist_ok=True)
    
    safe_name = "Aksam_Akbar_Resume"
    html_filename = f"{job_id}_{safe_name}.html"
    pdf_filename = f"{job_id}_{safe_name}.pdf"
    
    html_path = RESUMES_DIR / html_filename
    pdf_path = RESUMES_DIR / pdf_filename
    
    # Render HTML
    rendered_html = render_resume_to_html(profile_data, html_path)
    
    # Convert HTML to PDF using headless Chrome/Edge
    browser_exe = get_browser_exe()
    pdf_generated = False
    
    if browser_exe:
        cmd = [
            browser_exe,
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--no-default-browser-check",
            "--no-pdf-header-footer",
            f"--print-to-pdf={str(pdf_path)}",
            str(html_path.resolve())
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, timeout=10)
            if pdf_path.exists() and pdf_path.stat().st_size > 1000:
                pdf_generated = True
        except Exception as e:
            # Fallback to serving the HTML resume
            pass
            
    return {
        "html_path": str(html_path),
        "pdf_path": str(pdf_path) if pdf_generated else str(html_path),
        "pdf_filename": pdf_filename if pdf_generated else html_filename,
        "is_pdf": pdf_generated
    }
