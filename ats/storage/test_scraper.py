import urllib.request
import re
from bs4 import BeautifulSoup

url = 'https://in.indeed.com/jobs?q=Data+Analyst+fresher&l=Bengaluru&fromage=7'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
try:
    with urllib.request.urlopen(req, timeout=8) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
        job_keys = list(set(re.findall(r'data-jk=["\']([a-zA-Z0-9]+)["\']', html)))
        print(f"Found {len(job_keys)} Indeed direct job keys!")
        for jk in job_keys[:5]:
            print(f"https://in.indeed.com/viewjob?jk={jk}")
except Exception as e:
    print("Indeed fetch status:", e)
