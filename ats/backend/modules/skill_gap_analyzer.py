from typing import List, Dict, Any
from ..database import get_skill_gaps

SKILL_ROADMAP_DATABASE = {
    "Snowflake": {
        "category": "Cloud Data Warehousing",
        "demand": "Very High",
        "gcc_countries": ["Dubai (UAE)", "Saudi Arabia (Riyadh)"],
        "why_it_matters": "Builds directly on your SQL Server & Star Schema expertise. Top enterprise requirement for cloud analytics in Bengaluru, Mumbai, and GCC.",
        "estimated_hours": "15-20 Hours",
        "recommended_project": "Replicate your Medallion SQL Data Warehouse into a free Snowflake 30-day trial instance using SnowSQL.",
        "youtube_search": "Snowflake for Data Analyst full course tutorial freeCodeCamp",
        "learning_resources": ["Snowflake Hands-on Essentials Badge (Free)", "Coursera Snowflake for Data Engineers"]
    },
    "Bigquery": {
        "category": "Cloud Analytics",
        "demand": "High",
        "gcc_countries": ["Dubai (UAE)"],
        "why_it_matters": "Google Cloud's serverless data warehouse; standard for marketing and ecommerce analytics (Swiggy, Noon, Zomato).",
        "estimated_hours": "10-15 Hours",
        "recommended_project": "Query Google Analytics 4 public e-commerce datasets using BigQuery SQL.",
        "youtube_search": "Google BigQuery tutorial for business analyst Luke Barousse",
        "learning_resources": ["Google Cloud Skills Boost BigQuery Quest"]
    },
    "Dbt": {
        "category": "Data Transformation & Engineering",
        "demand": "Rapidly Growing",
        "gcc_countries": ["Dubai (UAE)"],
        "why_it_matters": "Allows analysts to write modular SQL transformations with built-in version control and testing.",
        "estimated_hours": "12 Hours",
        "recommended_project": "Build dbt models on top of PostgreSQL/SQL Server with schema tests.",
        "youtube_search": "dbt tutorial for beginners Data with Zach",
        "learning_resources": ["dbt Fundamentals Free Certification (getdbt.com)"]
    },
    "Alteryx": {
        "category": "Automated ETL & Prep",
        "demand": "High in MNCs & GCC",
        "gcc_countries": ["Dubai (UAE)", "Qatar (Doha)"],
        "why_it_matters": "Heavily utilized by Big 4 (EY, Deloitte) and GCC conglomerates for automated finance and pricing data prep without coding.",
        "estimated_hours": "15 Hours",
        "recommended_project": "Automate daily supplier pricing reconciliation and variance checking.",
        "youtube_search": "Alteryx full course tutorial for beginner data analyst",
        "learning_resources": ["Alteryx Designer Core Certification Prep"]
    },
    "Google Analytics": {
        "category": "Digital & Product Analytics",
        "demand": "High for E-commerce & Startups",
        "gcc_countries": ["Dubai (UAE)"],
        "why_it_matters": "Complements your Marketing Analytics NLP project by connecting front-end user engagement metrics with sales numbers.",
        "estimated_hours": "8 Hours",
        "recommended_project": "Set up GA4 event tracking and build a Power BI connector dashboard.",
        "youtube_search": "GA4 Google Analytics 4 tutorial for analysts",
        "learning_resources": ["Google Skillshop GA4 Certification (Free)"]
    },
    "Power Automate": {
        "category": "Workflow Automation",
        "demand": "High in Enterprise Operations",
        "gcc_countries": ["Dubai (UAE)", "Kuwait"],
        "why_it_matters": "Pairs seamlessly with Excel and Power BI to automate scheduled refresh alerts, approval emails, and data extraction.",
        "estimated_hours": "10 Hours",
        "recommended_project": "Build an automated flow that extracts attachments from email and appends rows to an Excel/SQL table.",
        "youtube_search": "Power Automate desktop tutorial for excel automation",
        "learning_resources": ["Microsoft Learn Power Automate Fundamentals"]
    },
    "Aws": {
        "category": "Cloud Infrastructure",
        "demand": "High",
        "gcc_countries": ["Dubai (UAE)", "Saudi Arabia"],
        "why_it_matters": "Amazon S3, Athena, and QuickSight are commonly used alongside SQL for enterprise reporting.",
        "estimated_hours": "20 Hours",
        "recommended_project": "Store CSV retail datasets in AWS S3 and query them directly using Amazon Athena SQL.",
        "youtube_search": "AWS Athena and S3 for Data Analysis tutorial",
        "learning_resources": ["AWS Cloud Practitioner Essentials (Free)"]
    },
    "Azure": {
        "category": "Cloud Infrastructure",
        "demand": "Very High in India & Middle East",
        "gcc_countries": ["Dubai (UAE)", "Saudi Arabia (Riyadh)"],
        "why_it_matters": "Native ecosystem for Power BI, SQL Server, and Synapse Analytics.",
        "estimated_hours": "20 Hours",
        "recommended_project": "Connect Power BI Desktop to Azure SQL Database with scheduled automated refresh.",
        "youtube_search": "Azure Data Fundamentals DP-900 full course",
        "learning_resources": ["Microsoft Learn DP-900 (Azure Data Fundamentals)"]
    }
}

DEFAULT_ROADMAP = {
    "category": "Analytical & Business Tools",
    "demand": "Moderate",
    "why_it_matters": "Requested in current job market postings to complement core SQL/Excel stack.",
    "estimated_hours": "10 Hours",
    "recommended_project": "Implement a focused mini-case study demonstrating application in pricing or reporting.",
    "learning_resources": ["Online documentation & official quickstart guides"]
}

def analyze_skill_gaps() -> List[Dict[str, Any]]:
    recorded_gaps = get_skill_gaps(limit=20)
    analyzed = []
    
    # If database is fresh, supply key high-yield target tools
    detected_names = {r["skill_name"].title() for r in recorded_gaps}
    base_skills = ["Snowflake", "Dbt", "Alteryx", "Google Analytics", "Power Automate", "Bigquery", "Azure", "Aws"]
    
    for s in base_skills:
        if s not in detected_names:
            guide = SKILL_ROADMAP_DATABASE.get(s, DEFAULT_ROADMAP)
            recorded_gaps.append({
                "skill_name": s,
                "frequency": 3,
                "category": guide["category"],
                "gcc_countries": ",".join(guide.get("gcc_countries", [])),
                "gcc_countries_list": guide.get("gcc_countries", []),
                "is_completed": 0,
                "last_seen": "Recent"
            })
            
    for item in recorded_gaps:
        name = item["skill_name"].title()
        guide = SKILL_ROADMAP_DATABASE.get(name, DEFAULT_ROADMAP)
        
        db_gcc = item.get("gcc_countries_list", [])
        roadmap_gcc = guide.get("gcc_countries", [])
        all_gcc = sorted(list(set(db_gcc + roadmap_gcc)))
        
        gemini_prompt = (
            f"Act as a senior data analytics coach. Teach me {name} specifically for a Junior to Mid Business & Data Analyst. "
            f"Provide: 1) Core fundamentals and how it fits with SQL/Excel/Power BI, "
            f"2) The top 5 business/pricing use cases asked in job interviews, "
            f"3) Step-by-step practical implementation code/templates, and "
            f"4) A resume-ready weekend project I can build to showcase mastery."
        )
        
        youtube_query = guide.get("youtube_search", f"{name} tutorial for data analyst full course")
        
        analyzed.append({
            "skill_name": name,
            "frequency": item.get("frequency", 1),
            "category": guide.get("category", "Analytics Tool"),
            "demand": guide.get("demand", "High"),
            "gcc_countries": all_gcc,
            "is_gcc_priority": len(all_gcc) > 0,
            "is_completed": bool(item.get("is_completed", 0)),
            "why_it_matters": guide.get("why_it_matters", ""),
            "estimated_hours": guide.get("estimated_hours", "10-15 Hours"),
            "recommended_project": guide.get("recommended_project", ""),
            "learning_resources": guide.get("learning_resources", []),
            "gemini_prompt": gemini_prompt,
            "youtube_query": youtube_query
        })

    # Sort by frequency and demand
    analyzed.sort(key=lambda x: x["frequency"], reverse=True)
    return analyzed
