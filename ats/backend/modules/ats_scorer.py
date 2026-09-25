import re
import json
from typing import Dict, List, Set, Tuple, Any
from ..config import PROFILE_PATH

# Standard taxonomy of Data / Business Analytics keywords
ANALYTICS_SKILL_TAXONOMY = {
    # Core Tools
    "sql": ["sql", "mysql", "postgresql", "t-sql", "tsql", "sql server", "pl/sql", "mssql"],
    "excel": ["excel", "advanced excel", "vlookup", "xlookup", "pivot tables", "power query", "vba", "macros", "spreadsheets"],
    "power bi": ["power bi", "powerbi", "dax", "power query", "power pivot", "bi dashboards"],
    "python": ["python", "pandas", "numpy", "scikit-learn", "sklearn", "matplotlib", "seaborn"],
    "tableau": ["tableau", "tableau desktop", "data visualization", "visualizations"],
    "r": ["r programming", "r language", "r studio"],
    
    # Methodologies & Concepts
    "data analysis": ["data analysis", "data analytics", "exploratory data analysis", "eda", "quantitative analysis"],
    "business analysis": ["business analysis", "business intelligence", "bi", "requirements gathering", "brd", "stakeholder management"],
    "pricing": ["pricing analysis", "pricing strategy", "margin optimization", "pricing models", "revenue management", "discount compliance"],
    "forecasting": ["forecasting", "predictive analytics", "sales forecasting", "predictive models", "scenario modeling", "revenue forecasts"],
    "etl & warehousing": ["etl", "data warehouse", "data warehousing", "data modeling", "star schema", "medallion architecture", "data pipelines", "data cleansing"],
    "reporting": ["mis reporting", "reporting", "variance reports", "kpi tracking", "dashboards", "management reporting"],
    "operations & project management": ["project management", "operations", "process optimization", "root cause analysis", "jira", "agile", "scrum", "cross-functional"],
    "crm & erp": ["crm", "erp", "salesforce", "sap", "oracle"]
}

def load_master_profile() -> Dict[str, Any]:
    with open(PROFILE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def extract_profile_tokens(profile: Dict[str, Any]) -> Set[str]:
    tokens = set()
    
    # From summary & title
    text = (profile.get("title", "") + " " + profile.get("summary", "")).lower()
    for word in re.findall(r'[a-zA-Z0-9_\-\+\#]+', text):
        tokens.add(word)
        
    # From work experience
    for exp in profile.get("work_experience", []):
        for kw in exp.get("keywords", []):
            tokens.add(kw.lower())
        for b in exp.get("bullets", []):
            for word in re.findall(r'[a-zA-Z0-9_\-\+\#]+', b.lower()):
                tokens.add(word)
                
    # From projects
    for proj in profile.get("projects", []):
        for kw in proj.get("keywords", []):
            tokens.add(kw.lower())
        for b in proj.get("bullets", []):
            for word in re.findall(r'[a-zA-Z0-9_\-\+\#]+', b.lower()):
                tokens.add(word)
                
    # From skills list
    skills_obj = profile.get("skills", {})
    for cat, skill_list in skills_obj.items():
        for s in skill_list:
            tokens.add(s.lower())
            for word in re.findall(r'[a-zA-Z0-9_\-\+\#]+', s.lower()):
                tokens.add(word)
                
    return tokens

def analyze_job_keywords(jd_text: str) -> Dict[str, Any]:
    jd_lower = jd_text.lower()
    profile = load_master_profile()
    profile_tokens = extract_profile_tokens(profile)
    
    matched_skills = []
    missing_skills = []
    
    # Check skill taxonomy groups
    for canonical_name, aliases in ANALYTICS_SKILL_TAXONOMY.items():
        # Check if JD mentions any alias
        jd_match = any(re.search(r'\b' + re.escape(alias) + r'\b', jd_lower) for alias in aliases)
        if jd_match:
            # Check if profile has any alias
            profile_has = any(
                alias in profile_tokens or any(alias in t for t in profile_tokens)
                for alias in aliases
            )
            if profile_has:
                matched_skills.append(canonical_name.title())
            else:
                missing_skills.append(canonical_name.title())

    # Detect additional technical keywords
    tech_keywords = [
        "snowflake", "bigquery", "azure", "aws", "gcp", "power automate", "looker",
        "dbt", "kafka", "spark", "alteryx", "hubspot", "jira", "salesforce",
        "statistics", "regression", "ab testing", "google analytics", "sap"
    ]
    for kw in tech_keywords:
        if re.search(r'\b' + re.escape(kw) + r'\b', jd_lower):
            display_kw = kw.title()
            if any(re.search(r'\b' + re.escape(kw) + r'\b', t) for t in profile_tokens):
                if display_kw not in matched_skills:
                    matched_skills.append(display_kw)
            else:
                if display_kw not in missing_skills:
                    missing_skills.append(display_kw)

    # Base match calculation
    total_found = len(matched_skills) + len(missing_skills)
    if total_found == 0:
        # Default relevance if general analytical terms exist
        baseline_score = 72.0
    else:
        raw_ratio = len(matched_skills) / total_found
        # Calculate realistic ATS baseline score
        # Core skills like SQL, Excel, Power BI have high weight in Aksam's resume
        core_boost = 0.0
        if "Sql" in matched_skills or "SQL" in matched_skills:
            core_boost += 5.0
        if "Excel" in matched_skills:
            core_boost += 5.0
        if "Power Bi" in matched_skills or "Power BI" in matched_skills:
            core_boost += 5.0
            
        baseline_score = round(min(88.0, max(50.0, (raw_ratio * 75.0) + core_boost + 15.0)), 1)

    return {
        "matched_skills": sorted(list(set(matched_skills))),
        "missing_skills": sorted(list(set(missing_skills))),
        "baseline_score": baseline_score
    }
