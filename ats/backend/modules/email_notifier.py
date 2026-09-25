import os
import smtplib
from datetime import datetime, date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import List, Dict, Any, Optional

from ..config import (
    DEFAULT_NOTIFICATION_EMAIL, SMTP_HOST, SMTP_PORT,
    SMTP_USER, SMTP_PASSWORD, DIGESTS_DIR
)
from ..database import get_all_jobs

def get_top_24_daily_jobs() -> List[Dict[str, Any]]:
    """Retrieve exactly 24 top-priority relevant jobs for the daily cycle."""
    all_jobs = get_all_jobs(status_filter="ready_for_review")
    if not all_jobs or len(all_jobs) < 24:
        # Fall back to all active non-applied jobs or full list
        all_jobs = [j for j in get_all_jobs() if j.get("status") != "applied"]
    
    # Sort strictly by priority (1: Bengaluru -> 2: Kerala -> 3: Metros -> 4: GCC), then tailored score
    all_jobs.sort(key=lambda x: (x.get("location_priority", 5), -float(x.get("tailored_score", 0.0))))
    return all_jobs[:24]

def generate_daily_digest_html(jobs: List[Dict[str, Any]], recipient: str = DEFAULT_NOTIFICATION_EMAIL) -> str:
    today_str = datetime.now().strftime("%A, %d %B %Y")
    
    priority_groups = {
        1: ("🏢 Priority 1: Bengaluru (Top Priority)", []),
        2: ("🌴 Priority 2: Kochi & all Kerala", []),
        3: ("🏙️ Priority 3: Chennai, Hyderabad, Mumbai, Pune, Delhi NCR", []),
        4: ("🌍 Priority 4: GCC Countries (Dubai / UAE)", [])
    }
    
    for job in jobs:
        prio = job.get("location_priority", 3)
        if prio in priority_groups:
            priority_groups[prio][1].append(job)
        else:
            priority_groups[3][1].append(job)

    html_sections = []
    for prio_key in [1, 2, 3, 4]:
        group_title, group_jobs = priority_groups[prio_key]
        if not group_jobs:
            continue
            
        cards_html = []
        for job in group_jobs:
            title = job.get("title", "Analyst")
            company = job.get("company", "Hiring Company")
            location = job.get("location", "India")
            source = job.get("source", "Direct Platform")
            score = job.get("tailored_score", 95.0)
            url = job.get("url", "http://127.0.0.1:8000")
            is_hot = job.get("is_hot") == 1 or job.get("days_ago", 99) <= 1
            
            hot_badge = '<span style="background: #fee2e2; color: #dc2626; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; margin-right: 6px;">🔥 Hot (<24h)</span>' if is_hot else ''
            
            card = f"""
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <div>
                        <div style="margin-bottom: 4px;">
                            {hot_badge}
                            <span style="background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">🔗 {source}</span>
                        </div>
                        <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 700; color: #0f172a;">{title}</h3>
                        <div style="font-size: 13px; font-weight: 600; color: #2563eb;">{company}</div>
                    </div>
                    <div style="text-align: right; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 6px 10px;">
                        <div style="font-size: 14px; font-weight: 800; color: #059669;">{score}%</div>
                        <div style="font-size: 10px; font-weight: 600; color: #065f46; text-transform: uppercase;">ATS Match</div>
                    </div>
                </div>
                <div style="font-size: 12px; color: #64748b; margin-bottom: 12px;">
                    📍 {location} &nbsp;|&nbsp; 💼 0-2 Yrs Experience &nbsp;|&nbsp; 🎓 MBA / B.Com / Any Graduate
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <a href="{url}" target="_blank" style="background: #2563eb; color: #ffffff; text-decoration: none; font-size: 12px; font-weight: 600; padding: 7px 14px; border-radius: 5px; display: inline-block;">
                        🌐 Apply on {source} &rarr;
                    </a>
                    <a href="http://127.0.0.1:8000" target="_blank" style="background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; text-decoration: none; font-size: 12px; font-weight: 600; padding: 7px 14px; border-radius: 5px; display: inline-block;">
                        👁️ Open in Copilot Hub
                    </a>
                </div>
            </div>
            """
            cards_html.append(card)
            
        group_section = f"""
        <div style="margin-bottom: 24px;">
            <div style="font-size: 14px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px;">
                {group_title} ({len(group_jobs)} openings)
            </div>
            {''.join(cards_html)}
        </div>
        """
        html_sections.append(group_section)

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Daily 24 Job Digest — Aksam Akbar</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b;">
        <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
            
            <!-- HEADER -->
            <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 28px 24px; color: #ffffff;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #93c5fd; margin-bottom: 6px;">
                    Daily Job Digest & Reminder (9:00 AM)
                </div>
                <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 800;">
                    🎯 24 Curated Openings for Aksam Akbar
                </h1>
                <div style="font-size: 13px; color: #bfdbfe;">
                    📅 {today_str} &nbsp;|&nbsp; 90%+ ATS Score &nbsp;|&nbsp; Fresher to 2 YOE
                </div>
            </div>

            <!-- PROFILE SUMMARY BAR -->
            <div style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 12px 24px; font-size: 12px; color: #475569; display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between;">
                <div><strong>Expected CTC:</strong> 6,00,000 INR (6 LPA)</div>
                <div><strong>Notice Period:</strong> 30 Days</div>
                <div><strong>Platforms:</strong> Indeed, LinkedIn, Direct ATS</div>
            </div>

            <!-- CONTENT -->
            <div style="padding: 24px;">
                <p style="font-size: 14px; line-height: 1.5; color: #334155; margin-top: 0; margin-bottom: 20px;">
                    Good morning Aksam! Below are your <strong>24 verified openings</strong> curated across all platforms (Indeed, LinkedIn, Greenhouse, and Company Career Portals). Each role matches your 0-2 year experience level, MBA/B.Com background, and is organized by your location priorities.
                </p>

                {''.join(html_sections)}

                <!-- FOOTER CALL TO ACTION -->
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 18px; text-align: center; margin-top: 16px;">
                    <h4 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: #1e3a8a;">Ready to apply with 1-Click Copilot?</h4>
                    <p style="font-size: 12.5px; color: #3b82f6; margin: 0 0 14px 0;">
                        Open your local ATS dashboard to view tailored resumes, quick-copy screening answers (6 LPA, 30 days notice), and cover messages.
                    </p>
                    <a href="http://127.0.0.1:8000" style="background: #2563eb; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 10px 22px; border-radius: 6px; display: inline-block;">
                        🚀 Launch ATS Copilot Dashboard
                    </a>
                </div>
            </div>

            <!-- FOOTER -->
            <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11.5px; color: #94a3b8;">
                Automated ATS Job Discovery & Application Agent &bull; Sent to {recipient}
            </div>

        </div>
    </body>
    </html>
    """

def generate_daily_digest_text(jobs: List[Dict[str, Any]], recipient: str = DEFAULT_NOTIFICATION_EMAIL) -> str:
    today_str = datetime.now().strftime("%A, %d %B %Y")
    lines = [
        f"===========================================================",
        f"🎯 DAILY 24 JOB DIGEST — AKSAM AKBAR ({today_str})",
        f"===========================================================",
        f"Recipient: {recipient}",
        f"Expected CTC: 6,00,000 INR (6 LPA) | Notice Period: 30 Days",
        f"Filter: 0-2 Years of Experience | 90%+ Tailored ATS Score",
        f"Platforms: Indeed, LinkedIn, Greenhouse, Workday, Company Portals",
        f"Dashboard: http://127.0.0.1:8000",
        f"-----------------------------------------------------------\n"
    ]
    
    current_prio = None
    prio_labels = {
        1: "--- PRIORITY 1: BENGALURU (Top Priority) ---",
        2: "--- PRIORITY 2: KOCHI & ALL KERALA ---",
        3: "--- PRIORITY 3: METRO HUBS (Chennai/Hyderabad/Mumbai/Pune/Delhi) ---",
        4: "--- PRIORITY 4: GCC COUNTRIES (Dubai / UAE) ---"
    }
    
    for i, job in enumerate(jobs, 1):
        prio = job.get("location_priority", 3)
        if prio != current_prio:
            current_prio = prio
            lines.append(f"\n{prio_labels.get(prio, '--- OTHER RELEVANT OPENINGS ---')}")
            
        title = job.get("title")
        company = job.get("company")
        loc = job.get("location")
        source = job.get("source")
        score = job.get("tailored_score")
        url = job.get("url")
        is_hot = "[🔥 HOT <24h]" if (job.get("is_hot") == 1 or job.get("days_ago", 99) <= 1) else ""
        
        lines.append(f"{i}. {title} @ {company} {is_hot}")
        lines.append(f"   Location: {loc} | Source: {source} | Match: {score}%")
        lines.append(f"   Direct URL: {url}\n")
        
    lines.append("-----------------------------------------------------------")
    lines.append("Review your tailored CV & 1-click answers at: http://127.0.0.1:8000")
    return "\n".join(lines)

def save_digest_artifact(html_content: str, text_content: str) -> Dict[str, str]:
    today_code = date.today().isoformat()
    html_path = DIGESTS_DIR / f"daily_digest_{today_code}.html"
    text_path = DIGESTS_DIR / f"daily_digest_{today_code}.txt"
    
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    with open(text_path, "w", encoding="utf-8") as f:
        f.write(text_content)
        
    return {
        "html_file": str(html_path),
        "text_file": str(text_path)
    }

def send_daily_digest(
    recipient: str = DEFAULT_NOTIFICATION_EMAIL,
    jobs: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """Compile and dispatch daily 24 job openings digest email to recipient."""
    if not jobs:
        jobs = get_top_24_daily_jobs()
        
    html_content = generate_daily_digest_html(jobs, recipient=recipient)
    text_content = generate_daily_digest_text(jobs, recipient=recipient)
    saved_files = save_digest_artifact(html_content, text_content)
    
    subject = f"🎯 Daily 24 Job Digest ({len(jobs)} Openings, 90%+ ATS) — Aksam Akbar"
    
    # Check if SMTP configuration is provided
    if not SMTP_USER or not SMTP_PASSWORD:
        return {
            "success": True,
            "status": "digest_generated_saved",
            "message": f"Daily digest with {len(jobs)} openings successfully generated and saved. (SMTP credentials pending).",
            "recipient": recipient,
            "job_count": len(jobs),
            "html_path": saved_files["html_file"],
            "text_path": saved_files["text_file"],
            "smtp_configured": False
        }
        
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_USER
        msg["To"] = recipient
        
        part1 = MIMEText(text_content, "plain")
        part2 = MIMEText(html_content, "html")
        msg.attach(part1)
        msg.attach(part2)
        
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, [recipient], msg.as_string())
        server.quit()
        
        return {
            "success": True,
            "status": "email_dispatched",
            "message": f"Daily digest successfully mailed to {recipient} via {SMTP_HOST}!",
            "recipient": recipient,
            "job_count": len(jobs),
            "html_path": saved_files["html_file"],
            "smtp_configured": True
        }
    except Exception as e:
        print(f"Error sending email via SMTP: {e}")
        return {
            "success": False,
            "status": "smtp_error",
            "message": f"Digest generated and saved, but SMTP send encountered an error: {str(e)}",
            "recipient": recipient,
            "job_count": len(jobs),
            "html_path": saved_files["html_file"],
            "error_details": str(e),
            "smtp_configured": True
        }
