import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"
RESUMES_DIR = STORAGE_DIR / "resumes"
PROFILE_PATH = BASE_DIR / "backend" / "profile" / "master_profile.json"
TEMPLATE_PATH = BASE_DIR / "backend" / "profile" / "template_ats.html"
DB_PATH = STORAGE_DIR / "ats_database.sqlite"

STORAGE_DIR.mkdir(parents=True, exist_ok=True)
RESUMES_DIR.mkdir(parents=True, exist_ok=True)

# User's Explicit Search Filters
TARGET_ROLES = [
    "Business Analyst",
    "Analyst",
    "Pricing Analyst",
    "Excel",
    "Data Analyst",
    "Operations Analyst",
    "Reporting Analyst",
    "Junior Analyst",
    "Account Manager",
    "BI Analyst",
    "Junior Business Analyst",
    "MIS Executive",
    "Commercial Analyst",
    "Revenue Analyst"
]

TARGET_LOCATIONS = [
    "Bengaluru",
    "Bangalore",
    "Kochi",
    "Cochin",
    "Kerala",
    "Trivandrum",
    "Thiruvananthapuram",
    "Calicut",
    "Kozhikode",
    "Mumbai",
    "Hyderabad",
    "Chennai",
    "Pune",
    "Delhi",
    "Noida",
    "Gurgaon",
    "Gurugram",
    "Dubai",
    "Abu Dhabi",
    "UAE",
    "Saudi Arabia",
    "Riyadh",
    "Jeddah",
    "Qatar",
    "Doha",
    "Oman",
    "Muscat",
    "Kuwait",
    "Bahrain",
    "Remote",
    "Hybrid"
]

MAX_POSTING_AGE_DAYS = 7
MAX_EXPERIENCE_YEARS = 2
MIN_BASELINE_ATS_SCORE = 70.0
TARGET_TAILORED_ATS_SCORE = 90.0
DAILY_APPLICATION_CAP = 25

# Gemini / LLM Config
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Email & Notification Config
DEFAULT_NOTIFICATION_EMAIL = "aksamakbar@gmail.com"
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
DIGESTS_DIR = STORAGE_DIR / "digests"
DIGESTS_DIR.mkdir(parents=True, exist_ok=True)
