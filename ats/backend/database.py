import sqlite3
import json
from datetime import datetime, date
from typing import List, Dict, Optional, Any
from .config import DB_PATH, DAILY_APPLICATION_CAP

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Jobs table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        location TEXT NOT NULL,
        description TEXT NOT NULL,
        url TEXT NOT NULL,
        source TEXT NOT NULL,
        posted_date TEXT,
        days_ago INTEGER DEFAULT 0,
        is_hot INTEGER DEFAULT 0,
        experience_req TEXT,
        baseline_score REAL DEFAULT 0.0,
        tailored_score REAL DEFAULT 0.0,
        status TEXT DEFAULT 'discovered',
        applied_at TEXT,
        tailored_pdf_path TEXT,
        tailored_resume_json TEXT,
        matched_keywords TEXT,
        missing_keywords TEXT,
        notes TEXT,
        created_at TEXT NOT NULL
    )
    ''')

    # Ensure columns exist if table was created previously
    cursor.execute("PRAGMA table_info(jobs)")
    cols = [row[1] for row in cursor.fetchall()]
    if "is_hot" not in cols:
        cursor.execute("ALTER TABLE jobs ADD COLUMN is_hot INTEGER DEFAULT 0")
    if "days_ago" not in cols:
        cursor.execute("ALTER TABLE jobs ADD COLUMN days_ago INTEGER DEFAULT 0")

    # Skill Gaps table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS skill_gaps (
        skill_name TEXT PRIMARY KEY,
        frequency INTEGER DEFAULT 1,
        category TEXT,
        gcc_countries TEXT DEFAULT '',
        learning_recommendation TEXT,
        is_completed INTEGER DEFAULT 0,
        last_seen TEXT
    )
    ''')

    cursor.execute("PRAGMA table_info(skill_gaps)")
    sg_cols = [row[1] for row in cursor.fetchall()]
    if "gcc_countries" not in sg_cols:
        cursor.execute("ALTER TABLE skill_gaps ADD COLUMN gcc_countries TEXT DEFAULT ''")
    if "is_completed" not in sg_cols:
        cursor.execute("ALTER TABLE skill_gaps ADD COLUMN is_completed INTEGER DEFAULT 0")

    conn.commit()
    conn.close()

def save_job(job_data: Dict[str, Any]) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
        INSERT OR REPLACE INTO jobs (
            id, title, company, location, description, url, source,
            posted_date, days_ago, is_hot, experience_req, baseline_score, tailored_score,
            status, applied_at, tailored_pdf_path, tailored_resume_json,
            matched_keywords, missing_keywords, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            job_data["id"],
            job_data["title"],
            job_data["company"],
            job_data["location"],
            job_data.get("description", ""),
            job_data.get("url", "#"),
            job_data.get("source", "Aggregator"),
            job_data.get("posted_date", datetime.now().isoformat()),
            int(job_data.get("days_ago", 0)),
            int(job_data.get("is_hot", 0)),
            job_data.get("experience_req", "0-2 Years"),
            float(job_data.get("baseline_score", 0.0)),
            float(job_data.get("tailored_score", 0.0)),
            job_data.get("status", "discovered"),
            job_data.get("applied_at"),
            job_data.get("tailored_pdf_path"),
            json.dumps(job_data.get("tailored_resume_json", {})),
            json.dumps(job_data.get("matched_keywords", [])),
            json.dumps(job_data.get("missing_keywords", [])),
            job_data.get("notes", ""),
            job_data.get("created_at", datetime.now().isoformat())
        ))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error saving job: {e}")
        return False
    finally:
        conn.close()

def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        data = dict(row)
        data["tailored_resume_json"] = json.loads(data["tailored_resume_json"] or "{}")
        data["matched_keywords"] = json.loads(data["matched_keywords"] or "[]")
        data["missing_keywords"] = json.loads(data["missing_keywords"] or "[]")
        return data
    return None

def calculate_location_priority(location: str) -> int:
    loc = (location or "").lower()
    # 1st Priority: Bengaluru
    if any(k in loc for k in ["bengaluru", "bangalore"]):
        return 1
    # 2nd Priority: Kochi and all Kerala
    if any(k in loc for k in ["kochi", "cochin", "kerala", "trivandrum", "calicut", "kozhikode"]):
        return 2
    # 3rd Priority: Chennai, Hyderabad, Mumbai, Pune, Delhi
    if any(k in loc for k in ["chennai", "hyderabad", "mumbai", "pune", "delhi", "noida", "gurgaon"]):
        return 3
    # 4th Priority: GCC Countries
    if any(k in loc for k in ["dubai", "uae", "saudi", "riyadh", "qatar", "doha", "oman", "kuwait", "bahrain"]):
        return 4
    return 5

def get_all_jobs(status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    if status_filter:
        cursor.execute("SELECT * FROM jobs WHERE status = ?", (status_filter,))
    else:
        cursor.execute("SELECT * FROM jobs")
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        data = dict(r)
        data["tailored_resume_json"] = json.loads(data["tailored_resume_json"] or "{}")
        data["matched_keywords"] = json.loads(data["matched_keywords"] or "[]")
        data["missing_keywords"] = json.loads(data["missing_keywords"] or "[]")
        data["location_priority"] = calculate_location_priority(data.get("location", ""))
        results.append(data)
        
    # Sort strictly by Location Priority (1st Bengaluru -> 2nd Kerala -> 3rd Metro Hubs -> 4th GCC), then highest ATS score
    results.sort(key=lambda x: (x["location_priority"], -float(x.get("tailored_score", 0.0))))
    return results

def update_job_status(job_id: str, status: str, notes: Optional[str] = None) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    applied_at = datetime.now().isoformat() if status == "applied" else None
    
    if applied_at:
        cursor.execute("UPDATE jobs SET status = ?, applied_at = ?, notes = COALESCE(?, notes) WHERE id = ?",
                       (status, applied_at, notes, job_id))
    else:
        cursor.execute("UPDATE jobs SET status = ?, notes = COALESCE(?, notes) WHERE id = ?",
                       (status, notes, job_id))
    conn.commit()
    conn.close()
    return True

def get_daily_application_count() -> int:
    today_prefix = date.today().isoformat()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM jobs WHERE status = 'applied' AND applied_at LIKE ?", (f"{today_prefix}%",))
    count = cursor.fetchone()[0]
    conn.close()
    return count

def extract_gcc_country(location: str) -> Optional[str]:
    loc_lower = (location or "").lower()
    if any(k in loc_lower for k in ["dubai", "uae", "abu dhabi", "sharjah"]):
        return "Dubai (UAE)"
    if any(k in loc_lower for k in ["saudi", "riyadh", "jeddah"]):
        return "Saudi Arabia"
    if any(k in loc_lower for k in ["qatar", "doha"]):
        return "Qatar"
    if any(k in loc_lower for k in ["kuwait"]):
        return "Kuwait"
    if any(k in loc_lower for k in ["oman", "muscat"]):
        return "Oman"
    if any(k in loc_lower for k in ["bahrain"]):
        return "Bahrain"
    return None

def record_skill_gaps(skills: List[str], location: str = ""):
    if not skills:
        return
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()
    gcc_country = extract_gcc_country(location)
    
    for skill in skills:
        # Check existing
        cursor.execute("SELECT gcc_countries, frequency FROM skill_gaps WHERE skill_name = ?", (skill,))
        existing = cursor.fetchone()
        
        if existing:
            countries_set = set(existing[0].split(",")) if existing[0] else set()
            if gcc_country:
                countries_set.add(gcc_country)
            new_countries = ",".join(filter(None, sorted(countries_set)))
            cursor.execute('''
            UPDATE skill_gaps 
            SET frequency = frequency + 1,
                gcc_countries = ?,
                last_seen = ?
            WHERE skill_name = ?
            ''', (new_countries, now_str, skill))
        else:
            init_countries = gcc_country if gcc_country else ""
            cursor.execute('''
            INSERT INTO skill_gaps (skill_name, frequency, category, gcc_countries, learning_recommendation, last_seen)
            VALUES (?, 1, 'Technical / Analytical Tool', ?, '', ?)
            ''', (skill, init_countries, now_str))
            
    conn.commit()
    conn.close()

def toggle_skill_completion(skill_name: str, is_completed: bool) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE skill_gaps SET is_completed = ? WHERE skill_name = ?",
                   (1 if is_completed else 0, skill_name))
    conn.commit()
    conn.close()
    return True

def get_skill_gaps(limit: int = 25) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM skill_gaps ORDER BY frequency DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        d = dict(r)
        d["gcc_countries_list"] = [c.strip() for c in (d.get("gcc_countries") or "").split(",") if c.strip()]
        results.append(d)
    return results
