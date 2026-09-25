# AutoApply ATS Platform

Intelligent Job Discovery, 90%+ ATS Resume Alteration, Application Copilot & Skill Gap Learning Platform tailored for **Aksam Akbar**.

## Features

1. **Job Sourcing Engine with Custom User Filters**:
   - **Target Roles**: Business Analyst, Analyst, Pricing Analyst, Excel-based roles, Data Analyst, Operations/Reporting Analyst, Junior Analyst, Account Manager.
   - **Target Locations**: Bengaluru, Kochi, all Kerala, Mumbai, Hyderabad, Chennai, Pune, Delhi, and GCC countries (Dubai, UAE, Saudi Arabia, Qatar, Oman, Kuwait, Bahrain) + Remote.
   - **Posting Freshness**: &le; 7 days old.
   - **Experience Requirement**: Fresher to 2 years (0-2 YOE).

2. **ATS Scoring & 90%+ Tailoring Engine**:
   - Evaluates baseline ATS keyword match.
   - Automatically tailors the professional summary, project emphasis, and prioritized skills to reach **90%+ ATS match score** for every selected job without falsifying candidate facts.
   - Compiles and archives an ATS-compliant PDF resume (`{job_id}_Aksam_Akbar_Resume.pdf`).

3. **Application Review & Submit Hub**:
   - Daily application meter capped at **15 applications/day** to safeguard portal credibility.
   - Side-by-side inspection: Job Description vs. Tailored Resume Preview.
   - Customized Cover Letter / Cold Email generator.
   - One-click application launch via browser copilot.

4. **Skill Gap & Future Learning Intelligence**:
   - Automatically tracks recurring technologies missing from current job requirements across Indian and GCC markets (e.g. Snowflake, dbt, Alteryx, BigQuery, Power Automate).
   - Generates personalized project ideas and direct links to free official certifications.

## Quick Start

Run the platform with one command:

```powershell
python ats/run.py
```

Then visit: `http://localhost:8000`
