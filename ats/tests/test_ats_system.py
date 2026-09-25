import os
import sys
from pathlib import Path

# Add root directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BASE_DIR))

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

from ats.backend.database import init_db, get_connection, save_job, get_job, update_job_status, get_daily_application_count
from ats.backend.modules.ats_scorer import load_master_profile, analyze_job_keywords
from ats.backend.modules.resume_tailorer import tailor_resume_for_job
from ats.backend.modules.pdf_generator import generate_ats_pdf
from ats.backend.modules.searcher import (
    search_and_process_jobs, is_experience_eligible, matches_target_location, matches_target_role
)
from ats.backend.modules.applicator import check_can_apply_today, generate_cover_message
from ats.backend.modules.skill_gap_analyzer import analyze_skill_gaps

def test_master_profile():
    print("[TEST 1] Testing Master Profile Loading...")
    profile = load_master_profile()
    assert profile["name"] == "AKSAM AKBAR"
    assert "Allianze Infosoft" in [exp["company"] for exp in profile["work_experience"]]
    assert "Pondicherry University" in [edu["institution"] for edu in profile["education"]]
    assert "SQL" in profile["skills"]["technical_stack"][0]
    print("✓ Master Profile valid and complete.")

def test_ats_scoring_and_tailoring():
    print("[TEST 2] Testing ATS Scoring and 90%+ Tailoring...")
    sample_jd = """
    We are seeking a Pricing Analyst to join our Dubai commercial team.
    Responsibilities:
    - Perform pricing and margin analysis using SQL and Advanced Excel.
    - Build Power BI variance dashboards to track revenue performance and discount compliance.
    - Conduct market competitor benchmarking and scenario modeling.
    Qualifications:
    - 0-2 years of experience in business or pricing analytics.
    - Proficiency in SQL, Excel, and Power BI.
    """
    
    analysis = analyze_job_keywords(sample_jd)
    print(f"  Baseline ATS Score: {analysis['baseline_score']}%")
    print(f"  Matched Skills: {analysis['matched_skills']}")
    assert analysis["baseline_score"] >= 70.0
    assert "Pricing" in analysis["matched_skills"]
    assert "Power Bi" in analysis["matched_skills"] or "Sql" in analysis["matched_skills"]

    tailored_result = tailor_resume_for_job("Pricing Analyst", "Global Retail", sample_jd)
    tailored_score = tailored_result["tailored_score"]
    print(f"  Tailored ATS Score: {tailored_score}%")
    assert tailored_score >= 90.0, f"Expected tailored score >= 90%, got {tailored_score}%"
    assert "pricing" in tailored_result["tailored_profile"]["title"].lower()
    print("✓ Resume successfully tailored to 90%+ ATS score.")

def test_pdf_generation():
    print("[TEST 3] Testing ATS-compliant PDF Generation...")
    profile = load_master_profile()
    pdf_info = generate_ats_pdf("unit_test_job", profile)
    print(f"  Generated PDF path: {pdf_info['pdf_path']}")
    assert os.path.exists(pdf_info["pdf_path"])
    assert os.path.getsize(pdf_info["pdf_path"]) > 1000
    print("✓ Machine-parseable ATS PDF generated successfully.")

def test_filters():
    print("[TEST 4] Testing Filters (<=7 days, 0-2 YOE, Locations, Roles)...")
    # Role matching
    assert matches_target_role("Junior Pricing Analyst") is True
    assert matches_target_role("Data Analyst - Operations") is True
    assert matches_target_role("Business Analyst (MIS)") is True
    assert matches_target_role("Account Manager") is True
    assert matches_target_role("Civil Construction Mason") is False

    # Location matching
    assert matches_target_location("Kochi, Kerala (Infopark)") is True
    assert matches_target_location("Dubai, UAE") is True
    assert matches_target_location("Bengaluru, India") is True
    assert matches_target_location("Riyadh, Saudi Arabia") is True
    assert matches_target_location("Berlin, Germany") is False

    # Experience filter
    assert is_experience_eligible("0-2 Years", "Pricing Analyst", "Looking for fresher or junior") is True
    assert is_experience_eligible("5+ Years", "Senior Data Analyst", "Lead the team") is False
    print("✓ All custom filters verified.")

def test_application_quota_and_cover_letter():
    print("[TEST 5] Testing Daily Application Cap (15/day) & Cover Letter...")
    quota = check_can_apply_today()
    assert quota["daily_cap"] == 15
    assert quota["allowed"] is True

    sample_job = {
        "title": "Business Analyst",
        "company": "Swiggy",
        "matched_keywords": ["SQL", "Power BI", "Excel", "MIS Reporting"]
    }
    cover = generate_cover_message(sample_job)
    assert "Aksam Akbar" in cover
    assert "Swiggy" in cover
    assert "Business Analyst" in cover
    print("✓ Daily quota logic and cover message generator verified.")

def test_skill_gap_analyzer():
    print("[TEST 6] Testing Skill Gap Learning Intelligence...")
    gaps = analyze_skill_gaps()
    assert len(gaps) > 0
    top_gap = gaps[0]
    assert "skill_name" in top_gap
    assert "why_it_matters" in top_gap
    assert "recommended_project" in top_gap
    assert len(top_gap["learning_resources"]) > 0
    print(f"  Identified Top Skill Gap: {top_gap['skill_name']} ({top_gap['category']})")
    print(f"  Recommended Project: {top_gap['recommended_project']}")
    print("✓ Skill Gap & Future Learning Intelligence verified.")

if __name__ == "__main__":
    init_db()
    test_master_profile()
    test_ats_scoring_and_tailoring()
    test_pdf_generation()
    test_filters()
    test_application_quota_and_cover_letter()
    test_skill_gap_analyzer()
    print("\n" + "="*50)
    print("🎉 ALL TESTS PASSED! AUTOAPPLY ATS SYSTEM VERIFIED.")
    print("="*50)
