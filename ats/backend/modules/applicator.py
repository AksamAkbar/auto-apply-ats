import os
import webbrowser
import re
from typing import Dict, Any, List
from ..config import DAILY_APPLICATION_CAP, RESUMES_DIR
from ..database import get_daily_application_count, update_job_status, get_job
from .ats_scorer import load_master_profile

# Default Candidate Screening Responses
STANDARD_ANSWERS = {
    "notice_period": "30 Days",
    "experience_years": "1 - 2 Years",
    "current_location": "Kochi, India",
    "relocation": "Yes, open to relocate immediately (Bengaluru, Mumbai, Hyderabad, Pune, Delhi, or GCC countries).",
    "work_authorization": "Indian Citizen. Open to GCC employment visa sponsorship or immediate domestic joining.",
    "expected_ctc": "6,00,000 INR (6 LPA)",
    "current_ctc": "Confidential / Negotiable",
    "highest_qualification": "Master of Business Administration (MBA in Data Analytics) - Pondicherry University (2024)"
}

def check_can_apply_today() -> Dict[str, Any]:
    current_count = get_daily_application_count()
    allowed = current_count < DAILY_APPLICATION_CAP
    return {
        "allowed": allowed,
        "current_count": current_count,
        "daily_cap": DAILY_APPLICATION_CAP,
        "remaining": max(0, DAILY_APPLICATION_CAP - current_count)
    }

def generate_cover_message(job: Dict[str, Any]) -> str:
    title = job.get("title", "Analyst")
    company = job.get("company", "the team")
    matched_skills = job.get("matched_keywords", ["SQL", "Advanced Excel", "Power BI"])
    skills_str = ", ".join(matched_skills[:4])
    
    message = f"""Dear Hiring Team at {company},

I am writing to express my strong enthusiasm for the {title} opening at {company}.

With an MBA in Data Analytics and hands-on experience in pricing analytics, reporting, and operational optimization, I bring direct expertise leveraging {skills_str} to translate complex datasets into measurable business growth.

In my recent experience as a Junior Pricing Analyst at Allianze Infosoft, I led SQL-driven pricing analyses, built Power BI variance dashboards to monitor margins and KPIs, and developed sensitivity models to support strategic commercial decisions. Furthermore, as an Associate Project Manager at Global Survey, I managed end-to-end data workflows and drove cross-functional process improvements.

I have tailored my resume specifically to highlight relevant achievements for the {title} role. I would welcome the opportunity to discuss how my analytical skill set and proactive approach can add immediate value to {company}.

Sincerely,
Aksam Akbar
+91 9539060872 | aksamakbar@gmail.com
LinkedIn: https://linkedin.com/in/aksamakbar | GitHub: https://github.com/aksamakbar
Kochi, India (Open to Relocation)
"""
    return message

def answer_screening_question(question: str, job: Dict[str, Any]) -> str:
    q_lower = question.lower()
    profile = load_master_profile()
    
    # 1. Notice period
    if any(k in q_lower for k in ["notice", "joining", "availability", "how soon", "start date"]):
        return "My official notice period is 30 days (negotiable for earlier buyout/release if required)."
        
    # 2. Relocation
    if any(k in q_lower for k in ["relocate", "relocation", "willing to move", "location", "hybrid", "on-site"]):
        loc = job.get("location", "the job location")
        return f"Yes, I am fully open and enthusiastic about relocating or working on-site in {loc}."

    # 3. Salary / CTC
    if any(k in q_lower for k in ["salary", "compensation", "ctc", "expectations", "remuneration", "package"]):
        return "My expected compensation is 6,00,000 INR (6 LPA), open to discussion based on company bands and role responsibilities."

    # 4. Work authorization / Visa
    if any(k in q_lower for k in ["visa", "sponsorship", "authorization", "citizen", "eligible to work"]):
        return "I am an Indian national holding a valid passport and eligible to work across India immediately, and open to employer visa sponsorship for GCC/international opportunities."

    # 5. Experience with SQL / Data Warehousing
    if any(k in q_lower for k in ["sql", "warehouse", "etl", "database", "stored procedure"]):
        return (
            "I have robust hands-on experience with SQL Server and T-SQL. In my portfolio project, I architected a modern "
            "Data Warehouse using Medallion Architecture (Bronze, Silver, Gold) with automated stored procedure ETL pipelines "
            "and Star Schema modeling for BI reporting. In my analyst roles, I regularly write complex SQL queries to analyze pricing "
            "and operational datasets."
        )

    # 6. Experience with Power BI / Tableau / Dashboards
    if any(k in q_lower for k in ["power bi", "tableau", "dashboard", "visualization", "dax"]):
        return (
            "I have deep experience creating interactive executive dashboards in Power BI. At Allianze Infosoft, I built variance reports "
            "and KPI dashboards tracking price realization and margins. I am proficient with DAX, data modeling, Power Query transformations, "
            "and delivering clean, actionable visualization for decision-makers."
        )

    # 7. Experience with Excel
    if any(k in q_lower for k in ["excel", "vlookup", "xlookup", "pivot", "vba", "macro"]):
        return (
            "I have expert-level proficiency in Advanced Excel, including dynamic array formulas (XLOOKUP), multi-dimensional Pivot Tables, "
            "Power Query ETL, financial modeling, sensitivity analyses, and automated reporting workflows."
        )

    # 8. Experience with Python / Machine Learning
    if any(k in q_lower for k in ["python", "pandas", "machine learning", "nlp", "predictive"]):
        return (
            "I utilize Python (Pandas, NumPy, Scikit-Learn) for exploratory data analysis and predictive modeling. For instance, I built a sales "
            "forecasting regression model across 8,500+ retail records and developed an NLP sentiment analysis model using VADER on e-commerce reviews."
        )

    # 9. Why should we hire you / Why this company
    if any(k in q_lower for k in ["why should we hire", "why do you want", "tell me about yourself", "why this role"]):
        company = job.get("company", "your organization")
        title = job.get("title", "Analyst")
        return (
            f"With an MBA in Data Analytics and verified experience across pricing analysis, operational reporting, and data warehousing, "
            f"I combine technical rigor in SQL, Excel, and Power BI with strong business acumen. I have a proven track record of reducing reporting "
            f"turnaround and identifying margin opportunities. I am eager to apply this proactive mindset to deliver immediate value as a {title} at {company}."
        )

    # General fallback
    return (
        f"Throughout my professional experience and MBA in Data Analytics, I have developed strong proficiency in data analysis, "
        f"cross-functional coordination, and business intelligence using SQL, Power BI, and Advanced Excel. I am proactive, detail-oriented, "
        f"and eager to apply these skills to solve business challenges."
    )

def launch_copilot_application(job_id: str) -> Dict[str, Any]:
    quota = check_can_apply_today()
    if not quota["allowed"]:
        return {
            "success": False,
            "message": f"Daily application quota reached ({DAILY_APPLICATION_CAP}/15 applied today). Please review your current applications and continue tomorrow!",
            "quota": quota
        }
        
    job = get_job(job_id)
    if not job:
        return {"success": False, "message": "Job not found."}
        
    url = job.get("url", "")
    pdf_filename = job.get("tailored_pdf_path", "")
    pdf_path = (RESUMES_DIR / pdf_filename).resolve() if pdf_filename else None
    
    # Open job application URL in user's browser
    if url and url.startswith("http"):
        webbrowser.open(url)
        
    profile = load_master_profile()
    cover_letter = generate_cover_message(job)
    
    copilot_data = {
        "candidate_info": {
            "full_name": profile["name"],
            "first_name": "Aksam",
            "last_name": "Akbar",
            "email": profile["contact"]["email"],
            "phone": profile["contact"]["phone"],
            "location": profile["contact"]["location"],
            "linkedin": profile["contact"]["linkedin"],
            "github": profile["contact"]["github"],
            "portfolio": profile["contact"]["portfolio"],
            "pdf_path": str(pdf_path) if pdf_path and pdf_path.exists() else "",
            "pdf_filename": pdf_filename
        },
        "standard_answers": STANDARD_ANSWERS,
        "cover_message": cover_letter
    }
    
    return {
        "success": True,
        "message": f"Copilot active for {job['title']} at {job['company']}. Portal opened in your browser!",
        "job_id": job_id,
        "job_title": job["title"],
        "company": job["company"],
        "copilot_data": copilot_data,
        "quota": quota
    }

def confirm_application_submission(job_id: str, notes: str = "Confirmed submitted via Copilot") -> Dict[str, Any]:
    quota = check_can_apply_today()
    if not quota["allowed"]:
        return {
            "success": False,
            "message": f"Daily application quota reached ({DAILY_APPLICATION_CAP}/15 applied today).",
            "quota": quota
        }
        
    job = get_job(job_id)
    if not job:
        return {"success": False, "message": "Job not found."}
        
    update_job_status(job_id, "applied", notes=notes)
    new_quota = check_can_apply_today()
    
    return {
        "success": True,
        "message": f"Application for {job['title']} at {job['company']} recorded successfully!",
        "job_id": job_id,
        "quota": new_quota
    }
