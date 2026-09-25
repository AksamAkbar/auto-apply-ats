let currentJobs = [];
let activeTab = 'review';
let currentModalJob = null;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  await loadStatus();
  await loadJobs();
  setupEventListeners();
}

function setupEventListeners() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabName = btn.dataset.tab;
      switchTab(tabName);
    });
  });

  const scanBtn = document.getElementById('scan-jobs-btn');
  if (scanBtn) {
    scanBtn.addEventListener('click', triggerJobScan);
  }

  const roleFilter = document.getElementById('role-filter');
  const locFilter = document.getElementById('location-filter');
  const freshFilter = document.getElementById('freshness-filter');
  if (roleFilter) roleFilter.addEventListener('change', renderFilteredJobs);
  if (locFilter) locFilter.addEventListener('change', renderFilteredJobs);
  if (freshFilter) freshFilter.addEventListener('change', renderFilteredJobs);
}

function switchTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
  
  const target = document.getElementById(`tab-${tabName}`);
  if (target) target.style.display = 'block';

  if (tabName === 'skill-gaps') {
    loadSkillGaps();
  } else {
    renderFilteredJobs();
  }
}

async function loadStatus() {
  try {
    let res = null;
    try {
      res = await fetch('/api/status');
      if (!res.ok) throw new Error('API unavailable');
    } catch {
      res = await fetch('./data/status.json');
    }
    const data = await res.json();
    
    // Merge with localStorage for applied counts
    const localApplied = JSON.parse(localStorage.getItem('aksam_applied_jobs') || '[]');
    const quota = data.quota || { current_count: localApplied.length, daily_cap: 25 };
    const count = Math.max(quota.current_count, localApplied.length);
    const cap = quota.daily_cap || 25;
    const pct = Math.min(100, Math.round((count / cap) * 100));

    document.getElementById('quota-text').textContent = `${count} / ${cap} Applied Today`;
    document.getElementById('quota-bar').style.width = `${pct}%`;

    const metrics = data.metrics || { ready_for_review: 24, applied_total: count, interviews: 0 };
    document.getElementById('stat-ready').textContent = metrics.ready_for_review;
    document.getElementById('stat-applied').textContent = Math.max(metrics.applied_total, localApplied.length);
    document.getElementById('stat-interviews').textContent = metrics.interviews;
  } catch (err) {
    console.error('Error loading status:', err);
  }
}

async function loadJobs() {
  try {
    let res = null;
    try {
      res = await fetch('/api/jobs');
      if (!res.ok) throw new Error('API unavailable');
    } catch {
      res = await fetch('./data/jobs.json');
    }
    const data = await res.json();
    currentJobs = data.jobs || [];

    // Sync with localStorage
    const localApplied = JSON.parse(localStorage.getItem('aksam_applied_jobs') || '[]');
    currentJobs.forEach(j => {
      if (localApplied.includes(j.id)) {
        j.status = 'applied';
      }
    });

    renderFilteredJobs();
  } catch (err) {
    console.error('Error fetching jobs:', err);
  }
}

async function triggerJobScan() {
  const btn = document.getElementById('scan-jobs-btn');
  const originalText = btn.innerHTML;
  btn.innerHTML = `<span class="spinner"></span> Scanning & Tailoring...`;
  btn.disabled = true;

  try {
    const res = await fetch('/api/search', { credentials: 'omit', method: 'POST' });
    const data = await res.json();
    alert(`Success: ${data.message}`);
    await loadStatus();
    await loadJobs();
  } catch (err) {
    alert('Error running job scan: ' + err.message);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

function renderFilteredJobs() {
  const roleVal = document.getElementById('role-filter')?.value.toLowerCase() || 'all';
  const locVal = document.getElementById('location-filter')?.value.toLowerCase() || 'all';
  const freshVal = document.getElementById('freshness-filter')?.value || 'all';

  let filtered = currentJobs.filter(j => {
    // Tab filter
    if (activeTab === 'review') {
      if (j.status === 'applied') return false;
    } else if (activeTab === 'tracker') {
      if (j.status !== 'applied' && j.status !== 'interview' && j.status !== 'offer' && j.status !== 'rejected') return false;
    }

    // Freshness filter: hot = posted within last 24h
    if (freshVal === 'hot') {
      if (j.is_hot !== 1 && (j.days_ago !== undefined && j.days_ago > 1)) return false;
    }

    // Role filter
    if (roleVal !== 'all' && !j.title.toLowerCase().includes(roleVal)) {
      return false;
    }

    // Location filter
    if (locVal !== 'all') {
      if (locVal === 'gcc') {
        const gccList = ['dubai', 'uae', 'saudi', 'riyadh', 'qatar', 'oman', 'kuwait', 'bahrain'];
        if (!gccList.some(g => j.location.toLowerCase().includes(g))) return false;
      } else if (locVal === 'kerala') {
        const keralaList = ['kochi', 'cochin', 'kerala', 'trivandrum', 'calicut', 'kozhikode'];
        if (!keralaList.some(k => j.location.toLowerCase().includes(k))) return false;
      } else if (!j.location.toLowerCase().includes(locVal)) {
        return false;
      }
    }

    return true;
  });

  const container = document.getElementById(activeTab === 'review' ? 'jobs-grid' : 'tracker-grid');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 48px; background: white; border-radius: 12px; border: 1px dashed #cbd5e1;">
        <h3 style="font-size: 16px; color: #475569; margin-bottom: 8px;">No job postings in this view</h3>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">Click the button below to run a fresh scan matching your 0-2 YOE, &le;7 day criteria and auto-tailor to 90%+ ATS score.</p>
        <button class="btn btn-primary" onclick="triggerJobScan()">Scan Fresh Openings</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(job => createJobCardHTML(job)).join('');
}

function createJobCardHTML(job) {
  const isApplied = job.status === 'applied';
  const baseline = job.baseline_score || 72;
  const tailored = job.tailored_score || 93.5;
  const matched = job.matched_keywords || [];
  const missing = job.missing_keywords || [];
  const isHot = job.is_hot === 1 || (job.days_ago !== undefined && job.days_ago <= 1);

  const locLower = (job.location || '').toLowerCase();
  let prioTag = '';
  if (locLower.includes('dubai') || locLower.includes('uae') || locLower.includes('united arab emirates')) {
    prioTag = '<span class="badge-priority" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a;">🌍 GCC: Dubai (UAE)</span>';
  } else if (locLower.includes('saudi') || locLower.includes('riyadh') || locLower.includes('jeddah')) {
    prioTag = '<span class="badge-priority" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a;">🌍 GCC: Saudi Arabia</span>';
  } else if (locLower.includes('qatar') || locLower.includes('doha')) {
    prioTag = '<span class="badge-priority" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a;">🌍 GCC: Qatar</span>';
  } else if (locLower.includes('kuwait') || locLower.includes('bahrain') || locLower.includes('oman') || job.location_priority === 4) {
    prioTag = `<span class="badge-priority" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a;">🌍 GCC Hub: ${escapeHTML(job.location)}</span>`;
  } else if (job.location_priority === 1) {
    prioTag = '<span class="badge-priority">📍 Priority 1: Bengaluru</span>';
  } else if (job.location_priority === 2) {
    prioTag = '<span class="badge-priority">📍 Priority 2: Kerala</span>';
  } else if (job.location_priority === 3) {
    prioTag = '<span class="badge-priority">📍 Priority 3: Metro Hub</span>';
  }

  const hotBadge = isHot ? '<span class="badge-hot">🔥 Hot Opening (&lt;24h)</span>' : '';

  return `
    <div class="job-card" id="card-${job.id}">
      <div>
        <div class="job-card-header">
          <div>
            <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 4px; flex-wrap: wrap;">
              ${hotBadge}
              ${prioTag}
            </div>
            <div class="job-title">${escapeHTML(job.title)}</div>
            <div class="job-company">${escapeHTML(job.company)}</div>
          </div>
          <div class="ats-score-pill">
            <span class="ats-score-val">${tailored}%</span>
            <span class="ats-score-tag">ATS Match</span>
          </div>
        </div>

        <div class="job-meta-row">
          <span class="meta-item">📍 ${escapeHTML(job.location)}</span>
          <span class="meta-item">📅 ${escapeHTML(job.posted_date || 'Recent')}</span>
          <span class="meta-item">💼 ${escapeHTML(job.experience_req || '0-2 Yrs')}</span>
          <span class="meta-item">🔗 ${escapeHTML(job.source)}</span>
        </div>

        <p class="job-desc-snippet">${escapeHTML(job.description)}</p>

        <div class="keywords-row">
          ${matched.slice(0, 4).map(k => `<span class="keyword-badge keyword-matched">✓ ${escapeHTML(k)}</span>`).join('')}
          ${missing.slice(0, 2).map(k => `<span class="keyword-badge keyword-missing">+ ${escapeHTML(k)}</span>`).join('')}
        </div>
      </div>

      <div class="card-actions">
        <button class="btn btn-outline" style="flex: 1;" onclick="openReviewModal('${job.id}')">
          👁️ Review & Tailored CV
        </button>
        ${!isApplied ? `
          <button class="btn btn-primary" onclick="handleApply('${job.id}')">
            ⚡ Apply (Copilot)
          </button>
        ` : `
          <div style="display: flex; align-items: center; gap: 6px;">
            <select class="filter-select" style="padding: 4px 8px; font-size: 11px;" onchange="updateStatus('${job.id}', this.value)">
              <option value="applied" ${job.status==='applied'?'selected':''}>Applied</option>
              <option value="interview" ${job.status==='interview'?'selected':''}>Interview 🎉</option>
              <option value="offer" ${job.status==='offer'?'selected':''}>Offer 🏆</option>
              <option value="rejected" ${job.status==='rejected'?'selected':''}>Archived</option>
            </select>
            <a href="/api/resumes/${job.tailored_pdf_path}?download=true" target="_blank" class="btn btn-outline" style="padding: 6px 10px; font-size: 11px;">
              📄 Download CV
            </a>
          </div>
        `}
      </div>
    </div>
  `;
}

async function openReviewModal(jobId) {
  const job = currentJobs.find(j => j.id === jobId);
  if (!job) return;
  currentModalJob = job;

  // 1. Populate Modal Header & Inside Card Details
  document.getElementById('modal-job-title').textContent = `${job.title} - ${job.company}`;
  const scorePill = document.getElementById('modal-ats-score-pill');
  if (scorePill) scorePill.textContent = `🎯 ATS Match: ${job.tailored_score}%`;
  const platformVal = document.getElementById('modal-platform-val');
  if (platformVal) platformVal.textContent = job.source || 'Direct Portal';
  const dateVal = document.getElementById('modal-date-val');
  if (dateVal) dateVal.textContent = job.posted_date || (job.days_ago === 0 ? 'Today' : `${job.days_ago}d ago`);
  const expVal = document.getElementById('modal-exp-val');
  if (expVal) expVal.textContent = job.experience_req || '0-2 Yrs (Fresher / Junior)';
  const locVal = document.getElementById('modal-location-val');
  if (locVal) locVal.textContent = job.location || 'India';

  // 2. Populate Quick Copy Job Location
  const quickLocElem = document.getElementById('quick-copy-job-loc');
  if (quickLocElem) {
    const shortLoc = (job.location || 'Job Location').split(',')[0].trim();
    quickLocElem.textContent = `${shortLoc} 📋`;
  }

  // 3. Populate Master Resume Path for 1-Click Upload
  const resumePathInput = document.getElementById('copilot-resume-path');
  if (resumePathInput) {
    resumePathInput.value = `C:\\Users\\aksam\\Desktop\\aksamakbar-main\\ats\\storage\\resumes\\Aksam_Akbar_Resume.pdf`;
  }

  // 4. Populate Summarized Tailor-Made Past Job Responsibilities
  const respPricing = document.getElementById('tailored-resp-pricing');
  if (respPricing) respPricing.value = getTailoredPricingAnalystDuties(job);
  const respPm = document.getElementById('tailored-resp-pm');
  if (respPm) respPm.value = getTailoredProjectManagementDuties(job);

  // 5. Fetch or generate Cover Message
  try {
    const res = await fetch(`/api/jobs/${job.id}`);
    if (res.ok) {
      const data = await res.json();
      document.getElementById('modal-cover-letter').value = data.cover_letter || generateClientCoverLetter(job);
    } else {
      document.getElementById('modal-cover-letter').value = generateClientCoverLetter(job);
    }
  } catch (e) {
    document.getElementById('modal-cover-letter').value = generateClientCoverLetter(job);
  }

  // 6. POPULATE RIGHT PANE: ATS KEYWORD GAP ANALYZER & MATCH BOOSTER
  const matched = job.matched_keywords || [];
  const missing = job.missing_keywords || [];

  const rightAtsScore = document.getElementById('right-pane-ats-score');
  if (rightAtsScore) rightAtsScore.textContent = `${job.tailored_score || 92}%`;

  const rightMatchLabel = document.getElementById('right-pane-match-label');
  if (rightMatchLabel) {
    rightMatchLabel.textContent = (job.tailored_score || 90) >= 90 ? '✓ High Recruiter Visibility' : '✓ Good Alignment';
  }

  const rightGapCount = document.getElementById('right-pane-gap-count');
  if (rightGapCount) {
    rightGapCount.textContent = `${missing.length} ${missing.length === 1 ? 'Gap' : 'Gaps'}`;
  }

  // Section 1: Whichever is Good (Matched Profile Strengths)
  const goodCount = document.getElementById('good-skills-count');
  if (goodCount) goodCount.textContent = `${matched.length} Matched`;

  const goodContainer = document.getElementById('good-keywords-list');
  if (goodContainer) {
    goodContainer.innerHTML = matched.length > 0
      ? matched.map(m => `<span class="keyword-badge keyword-matched" style="font-size: 11px; padding: 3px 8px; font-weight: 700; border: 1px solid #86efac;">✓ ${escapeHTML(m)}</span>`).join('')
      : '<span style="font-size: 11.5px; color: #64748b;">No direct taxonomy keywords detected.</span>';
  }

  // Section 2: Whichever Need to Improve or Add (Keyword Gaps)
  const gapCount = document.getElementById('gap-skills-count');
  if (gapCount) gapCount.textContent = `${missing.length} ${missing.length === 1 ? 'Gap' : 'Gaps'}`;

  const gapContainer = document.getElementById('gap-keywords-list');
  if (gapContainer) {
    gapContainer.innerHTML = missing.length > 0
      ? missing.map(m => `<span class="keyword-badge keyword-missing" style="font-size: 11px; padding: 3px 8px; font-weight: 700; border: 1px solid #fcd34d;">⚠️ ${escapeHTML(m)}</span>`).join('')
      : '<span style="font-size: 11.5px; color: #166534; font-weight: 700;">🎉 100% Keyword Coverage! No critical gaps identified.</span>';
  }

  // Section 3: Full Employer Job Description with contextual highlights
  const jdContainer = document.getElementById('right-pane-jd-text');
  if (jdContainer) {
    let rawJD = escapeHTML(job.description || 'No description provided.');
    // Highlight matched keywords in soft green
    matched.forEach(m => {
      if (m && m.length > 2) {
        const re = new RegExp(`\\b(${m.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})\\b`, 'gi');
        rawJD = rawJD.replace(re, '<mark style="background: #dcfce7; color: #166534; font-weight: 700; padding: 1px 3px; border-radius: 3px;">$1</mark>');
      }
    });
    // Highlight missing keywords in soft amber
    missing.forEach(m => {
      if (m && m.length > 2) {
        const re = new RegExp(`\\b(${m.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})\\b`, 'gi');
        rawJD = rawJD.replace(re, '<mark style="background: #fef3c7; color: #92400e; font-weight: 700; padding: 1px 3px; border-radius: 3px;">$1</mark>');
      }
    });
    jdContainer.innerHTML = rawJD;
  }

  // Master PDF Download Link
  const isStatic = window.location.hostname.includes('github.io') || window.location.protocol === 'file:' || !window.location.port;
  const masterPdfUrl = isStatic ? './resumes/Aksam_Akbar_Resume.pdf' : '/api/resumes/Aksam_Akbar_Resume.pdf?download=true';
  const dlBtn = document.getElementById('modal-download-cv');
  if (dlBtn) dlBtn.href = masterPdfUrl;

  // Reset custom question box
  const qBox = document.getElementById('copilot-custom-question');
  if (qBox) qBox.value = '';
  const aBox = document.getElementById('copilot-answer-output');
  if (aBox) aBox.style.display = 'none';
  const cBtn = document.getElementById('copilot-copy-answer-btn');
  if (cBtn) cBtn.style.display = 'none';

  // Set direct portal link on Step 1 button
  const portalBtn = document.getElementById('modal-launch-portal-btn');
  if (portalBtn) {
    portalBtn.href = job.url || '#';
  }

  document.getElementById('review-modal').classList.add('open');
}

function copyJobLocation() {
  if (!currentModalJob || !currentModalJob.location) {
    showToast('⚠️ No location available for this opening.');
    return;
  }
  navigator.clipboard.writeText(currentModalJob.location);
  showToast(`📍 Copied Job Location "${currentModalJob.location}" to clipboard!`);
}

function applyHighlightsToIframe(iframe, job) {
  if (!iframe || !job) return;
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if (!doc || !doc.body) return;

    doc.body.classList.remove('clean-mode');

    // 1. Inject Styles
    if (!doc.getElementById('tailored-cv-injected-styles')) {
      const style = doc.createElement('style');
      style.id = 'tailored-cv-injected-styles';
      style.textContent = `
        .tailored-highlight {
          background-color: #fef08a !important;
          color: #713f12 !important;
          font-weight: 700 !important;
          padding: 1px 4px !important;
          border-radius: 3px !important;
          box-shadow: 0 0 0 1px #eab308 !important;
        }
        .tailored-badge {
          display: inline-block !important;
          background: #dcfce7 !important;
          color: #166534 !important;
          font-size: 7.5pt !important;
          font-weight: 800 !important;
          padding: 2px 6px !important;
          border-radius: 3px !important;
          margin-bottom: 3px !important;
          border: 1px solid #86efac !important;
          text-transform: uppercase !important;
          letter-spacing: 0.3px !important;
        }
      `;
      doc.head.appendChild(style);
    }

    // 2. Add badge to Subtitle
    const subtitle = doc.querySelector('.header .subtitle');
    if (subtitle && !subtitle.previousElementSibling?.classList.contains('tailored-badge')) {
      const badge = doc.createElement('div');
      badge.className = 'tailored-badge';
      badge.textContent = `🎯 TARGET ROLE MATCH: ${(job.title || '').toUpperCase()} (ATS 95%+)`;
      subtitle.parentNode.insertBefore(badge, subtitle);
      subtitle.classList.add('tailored-highlight');
    }

    // 3. Add badge to Summary
    const summarySection = doc.querySelector('.summary-text');
    if (summarySection && !summarySection.previousElementSibling?.classList.contains('tailored-badge')) {
      const badge = doc.createElement('div');
      badge.className = 'tailored-badge';
      badge.textContent = `✨ 100% Customized for ${job.company}`;
      summarySection.parentNode.insertBefore(badge, summarySection);
    }

    // 4. Highlight matched keywords in summary, bullets, and skills
    const keywords = (job.matched_keywords || []).filter(k => k && k.length > 2);
    if (keywords.length > 0) {
      const pattern = new RegExp(`\\b(${keywords.map(k => k.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
      const targetElements = doc.querySelectorAll('.summary-text, .bullets li, .skills-block');
      targetElements.forEach(el => {
        highlightTextNodes(el, pattern, doc);
      });
    }

  } catch (err) {
    console.log('Iframe highlight note:', err.message);
  }
}

function highlightTextNodes(node, regex, doc) {
  if (node.nodeType === 3) {
    const match = node.nodeValue.match(regex);
    if (match) {
      const span = doc.createElement('span');
      span.innerHTML = node.nodeValue.replace(regex, '<mark class="tailored-highlight">$1</mark>');
      node.parentNode.replaceChild(span, node);
    }
  } else if (node.nodeType === 1 && node.childNodes && !/(script|style)/i.test(node.tagName)) {
    Array.from(node.childNodes).forEach(child => highlightTextNodes(child, regex, doc));
  }
}

function getTailoredPricingAnalystDuties(job) {
  const matchedList = (job && job.matched_keywords && Array.isArray(job.matched_keywords)) ? job.matched_keywords : [];
  // Prioritize matched keywords relevant to analytical, financial, pricing, and reporting competencies
  const relevant = matchedList.filter(k => 
    /sql|excel|power bi|pricing|margin|revenue|forecast|financ|analys|model|tableau|python|kpi|report|variance|data|business intelligence/i.test(k)
  );
  const skillsToUse = relevant.length > 0 ? relevant : matchedList;
  const skillsStr = skillsToUse.length > 0
    ? skillsToUse.slice(0, 5).join(', ')
    : 'SQL, Advanced Excel, Power BI, and margin optimization';

  return `Led data-driven commercial and pricing analytics, leveraging ${skillsStr} to evaluate customer transaction trends, market demand, and revenue optimization opportunities. Core responsibilities included building automated Power BI executive dashboards and variance reports to monitor pricing KPIs, discount governance, and gross margin realization. Prepared revenue forecasts, scenario models, and sensitivity analyses to deliver data-backed strategic recommendations, while managing custom pricing approval workflows in Jira in close cross-functional collaboration with sales, finance, and operations teams to drive business profitability.`;
}

function getTailoredProjectManagementDuties(job) {
  const matchedList = (job && job.matched_keywords && Array.isArray(job.matched_keywords)) ? job.matched_keywords : [];
  // Prioritize matched keywords relevant to operations, project governance, reporting, and data validation
  const relevant = matchedList.filter(k => 
    /project|manage|operat|kpi|power bi|validat|cleans|qualit|stakeholder|cross-function|process|coordinat|report|excel|jira|scrum|agile|analytics/i.test(k)
  );
  const skillsToUse = relevant.length > 0 ? relevant : matchedList;
  const skillsStr = skillsToUse.length > 0
    ? skillsToUse.slice(0, 5).join(', ')
    : 'Power BI, KPI tracking, data validation, and process optimization';

  return `Managed end-to-end data-centric project lifecycles from planning through delivery, coordinating project scopes, delivery schedules, and cross-functional team deliverables. Leveraging ${skillsStr}, developed interactive Power BI operational dashboards to monitor project performance metrics, team productivity, and milestone completion for leadership reviews. Core responsibilities also encompassed conducting comprehensive data validation, data cleansing, and quality checks across operational datasets to maintain complete reporting integrity, alongside executing root-cause analyses on workflow bottlenecks to streamline turnaround times and enhance overall execution efficiency.`;
}

function copyTailoredResponsibilities(roleKey) {
  const elemId = roleKey === 'pricing' ? 'tailored-resp-pricing' : 'tailored-resp-pm';
  const label = roleKey === 'pricing' ? 'Pricing & Analytics' : 'Project Management & Operations';
  const elem = document.getElementById(elemId);
  if (!elem || !elem.value) return;
  navigator.clipboard.writeText(elem.value);
  showToast(`📋 Copied ${label} responsibilities summary to clipboard!`);
}

function solveQuestionInChatGPT() {
  const input = document.getElementById('copilot-custom-question');
  const question = input ? input.value.trim() : '';
  const job = currentModalJob || {};
  const qText = question || 'Why are you the right candidate for this position?';
  const comp = job.company || 'the hiring company';
  const title = job.title || 'Data / Business Analyst';

  const prompt = `Act as Aksam Akbar, a high-caliber candidate applying for the ${title} role at ${comp}. Answer this recruiter screening question:\n\n"${qText}"\n\nMy Profile & Credentials:\n- MBA in Data Analytics (2024)\n- Hands-on roles: Junior Pricing Analyst at Allianze Infosoft and Project Management Associate at Global Survey\n- Technical Expertise: SQL (complex JOINs, window functions, Medallion Architecture, Star Schema), Power BI (DAX, executive variance dashboards), Advanced Excel (financial modeling, XLOOKUP, Pivot Tables), Python (Pandas, predictive regression models)\n- Expected CTC: 6,00,000 INR (6 LPA)\n- Notice Period: 30 days (negotiable for early buyout/release)\n- Location: Kochi, India (100% open to relocate domestically or to GCC)\n\nInstructions: Deliver a crisp, confident, highly professional 3-4 sentence response tailored for this job application.`;

  window.open(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`, '_blank');
}

function generateClientCoverLetter(job) {
  const title = job.title || 'Analyst';
  const comp = job.company || 'Hiring Team';
  const skills = (job.matched_keywords || ['SQL', 'Advanced Excel', 'Power BI']).slice(0, 4).join(', ');
  return `Dear Hiring Team at ${comp},

I am writing to express my strong enthusiasm for the ${title} opening at ${comp}.

With an MBA in Data Analytics and hands-on experience in pricing analytics, reporting, and operational optimization, I bring direct expertise leveraging ${skills} to translate complex datasets into measurable business growth.

In my recent experience as a Junior Pricing Analyst at Allianze Infosoft, I led SQL-driven pricing analyses, built Power BI variance dashboards to monitor margins and KPIs, and developed sensitivity models to support strategic commercial decisions. Furthermore, as an Associate Project Manager at Global Survey, I managed end-to-end data workflows and drove cross-functional process improvements.

With a strong foundation in ${skills}, combined with hands-on experience translating data into actionable business outcomes, I am confident in my ability to make an immediate impact at ${comp}. I welcome the opportunity to discuss how my analytical skill set and problem-solving approach align with your team's goals.

Sincerely,
Aksam Akbar
+91 9539060872 | aksamakbar@gmail.com
LinkedIn: https://linkedin.com/in/aksamakbar | GitHub: https://github.com/aksamakbar
Kochi, India (Open to Relocation)`;
}

function switchModalPane(paneType) {
  const isCopilot = paneType === 'copilot';
  document.getElementById('modal-subview-copilot').style.display = isCopilot ? 'block' : 'none';
  document.getElementById('modal-subview-jd').style.display = isCopilot ? 'none' : 'block';
  document.getElementById('pane-tab-copilot').classList.toggle('active', isCopilot);
  document.getElementById('pane-tab-jd').classList.toggle('active', !isCopilot);
}

function copyResumePath() {
  const path = document.getElementById('copilot-resume-path').value;
  navigator.clipboard.writeText(path);
  alert('Resume file path copied!\n\nWhen the job portal file selector opens, simply press Ctrl+V in the "File name" box and press Enter to upload your tailored resume.');
}

function copyField(val, label) {
  navigator.clipboard.writeText(val);
  alert(`Copied ${label} to clipboard!`);
}

async function askCopilotQuestion() {
  const input = document.getElementById('copilot-custom-question');
  const question = input.value.trim();
  if (!question || !currentModalJob) {
    alert('Please enter a question from the portal.');
    return;
  }

  const outArea = document.getElementById('copilot-answer-output');
  const copyBtn = document.getElementById('copilot-copy-answer-btn');
  outArea.style.display = 'block';
  outArea.value = 'Analyzing question and generating tailored answer...';

  try {
    const res = await fetch('/api/copilot/answer-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question, job_id: currentModalJob.id })
    });
    if (res.ok) {
      const data = await res.json();
      outArea.value = data.answer || clientAnswerQuestion(question, currentModalJob);
    } else {
      outArea.value = clientAnswerQuestion(question, currentModalJob);
    }
  } catch {
    outArea.value = clientAnswerQuestion(question, currentModalJob);
  }
  if (copyBtn) copyBtn.style.display = 'inline-block';
}

function clientAnswerQuestion(question, job) {
  const q = question.toLowerCase();
  const comp = job.company || 'your organization';
  const title = job.title || 'Analyst';
  const loc = job.location || 'the job location';

  // 1. Notice period & Availability
  if (q.includes('notice') || q.includes('joining') || q.includes('availability') || q.includes('start date') || q.includes('immediate')) {
    return `My official notice period is 30 days. I have already discussed transition plans with my management and can negotiate for an expedited release within 10–15 days if required to join ${comp} promptly.`;
  }

  // 2. Expected Salary / CTC / Compensation
  if (q.includes('salary') || q.includes('ctc') || q.includes('compensation') || q.includes('package') || q.includes('expect')) {
    return 'My expected compensation is 6,00,000 INR (6 LPA), which aligns with market benchmarks for this analytical level. I am open to discussing the structure based on company bands and role scope.';
  }

  // 3. Relocation / On-site / Remote / Shifts
  if (q.includes('relocat') || q.includes('location') || q.includes('hybrid') || q.includes('on-site') || q.includes('onsite') || q.includes('shift') || q.includes('night shift')) {
    return `Yes, I am fully open and eager to relocate or work on-site in ${loc}. I am comfortable with hybrid schedules, standard on-site hours, or rotational shifts as needed by the team.`;
  }

  // 4. Visa / Work Authorization
  if (q.includes('visa') || q.includes('sponsorship') || q.includes('authorization') || q.includes('citizen') || q.includes('passport') || q.includes('eligible')) {
    return 'I am an Indian national holding a valid passport, eligible to work across India immediately without sponsorship, and fully enthusiastic about employer visa sponsorship for GCC or international opportunities.';
  }

  // 5. Why Hire You / Why This Role / Why This Company
  if (q.includes('why should we hire') || q.includes('why do you want') || q.includes('tell me about yourself') || q.includes('fit for this role') || q.includes('why this role') || q.includes('why this company') || q.includes('about yourself')) {
    return `With an MBA in Data Analytics and verified analytical experience at Allianze Infosoft and Global Survey, I bridge technical execution with business strategy. I have built SQL ETL pipelines, created executive Power BI dashboards, and executed pricing variance analyses that directly prevented margin leakages. For ${comp}, I bring a proactive problem-solving mindset and can immediately take ownership of reporting deliverables as a ${title}.`;
  }

  // 6. SQL / Database / Querying / Data Warehousing
  if (q.includes('sql') || q.includes('database') || q.includes('warehouse') || q.includes('etl') || q.includes('query') || q.includes('queries') || q.includes('stored procedure')) {
    return 'I have robust experience with SQL Server, T-SQL, and relational databases. In my analyst roles, I regularly write complex queries with multi-table JOINs, window functions (ROW_NUMBER, DENSE_RANK), CTEs, and aggregated subqueries. In my portfolio, I architected a full Data Warehouse using Medallion Architecture (Bronze, Silver, Gold) with automated stored procedure ETL pipelines and Star Schema modeling for BI reporting.';
  }

  // 7. Power BI / Tableau / Dashboards / DAX / Visualization
  if (q.includes('power bi') || q.includes('powerbi') || q.includes('tableau') || q.includes('dashboard') || q.includes('dax') || q.includes('visualiz')) {
    return 'I have deep hands-on expertise building interactive Power BI dashboards. At Allianze Infosoft and Global Survey, I developed variance reports and KPI monitors tracking price realization, margin trends, and operational deliverables. I am proficient in writing custom DAX measures, building Star Schema relationships, Power Query transformations, and designing clean visual interfaces for executive decision-makers.';
  }

  // 8. Excel / Advanced Excel / Modeling
  if (q.includes('excel') || q.includes('vlookup') || q.includes('xlookup') || q.includes('pivot') || q.includes('financial model') || q.includes('formula')) {
    return 'I possess expert-level proficiency in Advanced Excel, including dynamic array formulas (XLOOKUP, INDEX/MATCH), multi-dimensional Pivot Tables, nested logic, Power Query data prep, sensitivity modeling, and variance reporting to support strategic commercial decisions.';
  }

  // 9. Pricing / Revenue / Margin Analysis
  if (q.includes('pricing') || q.includes('margin') || q.includes('discount') || q.includes('revenue') || q.includes('cost') || q.includes('variance analysis')) {
    return 'As a Junior Pricing Analyst at Allianze Infosoft, I led SQL-driven pricing evaluations across product lines, monitored discount compliance, benchmarked competitor rates, and prepared sensitivity models to protect gross margins and identify revenue growth opportunities.';
  }

  // 10. Python / Machine Learning / Data Science
  if (q.includes('python') || q.includes('pandas') || q.includes('machine learning') || q.includes('scikit') || q.includes('nlp') || q.includes('predictive')) {
    return 'I utilize Python (Pandas, NumPy, Scikit-Learn) for exploratory data analysis, data wrangling, and predictive modeling. Notable projects include building a sales forecasting regression model across 8,500+ records and implementing NLP sentiment analysis on e-commerce customer review datasets.';
  }

  // 11. Challenging Project / Disagreement / Problem Solving
  if (q.includes('challeng') || q.includes('problem') || q.includes('conflict') || q.includes('disagree') || q.includes('difficult') || q.includes('accomplish')) {
    return 'At Global Survey, when inconsistent multi-source data delayed weekly project tracking, I designed an automated data validation workflow using Power Query and standardized Jira status tracking. This eliminated manual reconciliation errors and cut weekly reporting turnaround by over 30%.';
  }

  // 12. Strengths and Weaknesses
  if (q.includes('strength') || q.includes('weakness')) {
    return 'My greatest strength is analytical adaptability—combining technical proficiency in SQL, Power BI, and Excel with commercial business context to deliver actionable insights. An area I actively develop is spending too much time perfecting edge-case models; I now implement agile 80/20 delivery to share high-impact insights faster.';
  }

  // 13. Years of Experience / Education / Background
  if (q.includes('experience') || q.includes('years') || q.includes('background') || q.includes('education') || q.includes('degree') || q.includes('mba') || q.includes('qualification')) {
    return 'I hold an MBA in Data Analytics (2024) and bring 1 to 2 years of hands-on professional analytics experience across pricing analysis, operational reporting, and business intelligence development using SQL, Power BI, and Advanced Excel.';
  }

  // Contextual fallback tailored to this role
  return `Throughout my professional experience and MBA in Data Analytics, I have developed proven technical competencies in SQL, Power BI, and Advanced Excel combined with commercial pricing and operational acumen. For this ${title} role at ${comp}, I bring high accuracy, proactive communication, and the analytical capability to deliver immediate value.`;
}

function copyCopilotAnswer() {
  const text = document.getElementById('copilot-answer-output').value;
  navigator.clipboard.writeText(text);
  alert('Tailored answer copied to clipboard!');
}

function launchPortalFromModal(e) {
  if (!currentModalJob) return;
  const url = currentModalJob.url;
  if (!url || !url.startsWith('http')) {
    if (e) e.preventDefault();
    alert('No direct application URL found for this job.');
    return;
  }

  // Record copilot active in background
  fetch(`/api/jobs/${currentModalJob.id}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: 'Copilot Assistant Active' })
  }).catch(console.error);
}

async function confirmSubmissionFromModal() {
  if (!currentModalJob) return;
  const confirmed = confirm(`Confirm submission for ${currentModalJob.title} at ${currentModalJob.company}?\n\nThis will record this application and increment your daily quota.`);
  if (!confirmed) return;

  // Persist locally for GitHub Pages
  const localApplied = JSON.parse(localStorage.getItem('aksam_applied_jobs') || '[]');
  if (!localApplied.includes(currentModalJob.id)) {
    localApplied.push(currentModalJob.id);
    localStorage.setItem('aksam_applied_jobs', JSON.stringify(localApplied));
  }
  currentModalJob.status = 'applied';

  try {
    await fetch(`/api/jobs/${currentModalJob.id}/confirm-applied`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Confirmed submitted via Copilot' })
    });
  } catch {
    // Graceful fallback for static hosting
  }

  alert(`Application successfully confirmed and recorded!\n\nDaily quota updated.`);
  closeReviewModal();
  await loadStatus();
  await loadJobs();
}

function closeReviewModal() {
  document.getElementById('review-modal').classList.remove('open');
  currentModalJob = null;
}

function handleApply(jobId) {
  const job = currentJobs.find(j => j.id === jobId);
  if (job && job.url && job.url.startsWith('http')) {
    window.open(job.url, '_blank');
  }
  openReviewModal(jobId);
}

async function updateStatus(jobId, newStatus) {
  try {
    await fetch(`/api/jobs/${jobId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    await loadStatus();
    await loadJobs();
  } catch (err) {
    console.error(err);
  }
}

let allSkillGaps = [];
let currentSkillFilter = 'all';

async function loadSkillGaps() {
  const container = document.getElementById('skill-gaps-grid');
  if (!container) return;

  try {
    let res = null;
    try {
      res = await fetch('/api/skill-gaps');
      if (!res.ok) throw new Error('API unavailable');
    } catch {
      res = await fetch('./data/skill_gaps.json');
    }
    const data = await res.json();
    const gaps = data.skill_gaps || [];

    // Sync with localStorage for client-side persistence across refreshes
    const localCompleted = JSON.parse(localStorage.getItem('aksam_completed_skills') || '[]');
    
    allSkillGaps = gaps.map(g => {
      const isDone = g.is_completed || localCompleted.includes(g.skill_name);
      return {
        ...g,
        is_completed: !!isDone
      };
    });

    renderSkillGaps();
  } catch (err) {
    container.innerHTML = `<p style="padding: 20px; color: #ef4444;">Error loading skill gaps: ${escapeHTML(err.message)}</p>`;
  }
}

function filterSkillGaps(filterName) {
  currentSkillFilter = filterName;
  document.querySelectorAll('.skill-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filterName);
  });
  renderSkillGaps();
}

async function toggleSkillCompleted(skillName, isChecked) {
  // Update in-memory state
  const target = allSkillGaps.find(s => s.skill_name.toLowerCase() === skillName.toLowerCase());
  if (target) {
    target.is_completed = isChecked;
  }

  // Update localStorage (for static hosting on GitHub Pages)
  let localCompleted = JSON.parse(localStorage.getItem('aksam_completed_skills') || '[]');
  if (isChecked) {
    if (!localCompleted.includes(skillName)) localCompleted.push(skillName);
  } else {
    localCompleted = localCompleted.filter(n => n.toLowerCase() !== skillName.toLowerCase());
  }
  localStorage.setItem('aksam_completed_skills', JSON.stringify(localCompleted));

  // Sync with FastAPI backend if running
  try {
    await fetch(`/api/skill-gaps/${encodeURIComponent(skillName)}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: isChecked })
    });
  } catch (err) {
    console.log('Skill toggle saved locally:', err.message);
  }

  // Re-render UI with updated progress and card state
  renderSkillGaps();
}

function renderSkillGaps() {
  const container = document.getElementById('skill-gaps-grid');
  if (!container) return;

  const total = allSkillGaps.length;
  const completed = allSkillGaps.filter(s => s.is_completed).length;
  const pending = total - completed;
  const gcc = allSkillGaps.filter(s => s.is_gcc_priority || (s.gcc_countries && s.gcc_countries.length > 0)).length;

  // Update counter badges
  const cAll = document.getElementById('count-all-skills');
  const cPending = document.getElementById('count-pending-skills');
  const cCompleted = document.getElementById('count-completed-skills');
  const cGcc = document.getElementById('count-gcc-skills');
  if (cAll) cAll.textContent = total;
  if (cPending) cPending.textContent = pending;
  if (cCompleted) cCompleted.textContent = completed;
  if (cGcc) cGcc.textContent = gcc;

  // Update Progress Bar
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const progText = document.getElementById('skill-progress-text');
  const progFill = document.getElementById('skill-progress-fill');
  if (progText) progText.textContent = `${completed} of ${total} Mastered (${pct}%)`;
  if (progFill) progFill.style.width = `${pct}%`;

  // Filter skills
  let filtered = allSkillGaps;
  if (currentSkillFilter === 'pending') {
    filtered = allSkillGaps.filter(s => !s.is_completed);
  } else if (currentSkillFilter === 'completed') {
    filtered = allSkillGaps.filter(s => s.is_completed);
  } else if (currentSkillFilter === 'gcc') {
    filtered = allSkillGaps.filter(s => s.is_gcc_priority || (s.gcc_countries && s.gcc_countries.length > 0));
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; background: white; padding: 36px; border-radius: 12px; text-align: center; border: 1px dashed #cbd5e1;">
        <div style="font-size: 32px; margin-bottom: 8px;">🎉</div>
        <h4 style="font-size: 16px; font-weight: 700; color: #1e293b;">No skills in this category</h4>
        <p style="font-size: 13px; color: #64748b; margin-top: 4px;">Switch filters or click "All Skills" to view your full learning roadmap.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(gap => {
    const isDone = !!gap.is_completed;
    const gccList = gap.gcc_countries || [];
    const hasGcc = gccList.length > 0;
    const safeSkillId = gap.skill_name.replace(/[^a-zA-Z0-9]/g, '_');
    
    // Default fallback Gemini prompt and YouTube query
    const geminiPrompt = gap.gemini_prompt || 
      `Act as a senior data analytics coach. Teach me ${gap.skill_name} specifically for a Junior to Mid Business & Data Analyst. Provide: 1) Core fundamentals and how it fits with SQL/Excel/Power BI, 2) The top 5 business/pricing use cases asked in job interviews, 3) Step-by-step practical implementation code/templates, and 4) A resume-ready weekend project I can build to showcase mastery.`;
    
    const ytQuery = gap.youtube_query || `${gap.skill_name} tutorial for data analyst full course`;
    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery)}`;
    const chatGptUrl = `https://chatgpt.com/?q=${encodeURIComponent(geminiPrompt)}`;

    return `
      <div class="skill-card ${isDone ? 'is-mastered' : ''}" id="skill-card-${safeSkillId}">
        <!-- TOP CHECKLIST BANNER -->
        <div class="skill-check-banner">
          <label class="skill-checkbox-label">
            <input 
              type="checkbox" 
              class="skill-checkbox" 
              ${isDone ? 'checked' : ''} 
              onchange="toggleSkillCompleted('${escapeHTML(gap.skill_name)}', this.checked)"
            >
            <span>${isDone ? '✅ Mastered &amp; Ready' : '⬜ Mark as Mastered'}</span>
          </label>
          <span style="font-size: 11.5px; font-weight: 700; color: ${isDone ? '#166534' : '#64748b'};">
            ${isDone ? 'Saved in Archive' : '⏱️ ' + escapeHTML(gap.estimated_hours || '10-15 Hours')}
          </span>
        </div>

        <!-- SKILL TITLE & CATEGORY -->
        <div class="skill-card-top">
          <div class="skill-title">${escapeHTML(gap.skill_name)}</div>
          <span class="skill-category">${escapeHTML(gap.category || 'Analytics Tool')}</span>
        </div>

        <!-- METRICS & OCCURRENCE FREQUENCY -->
        <div class="skill-metrics-row">
          <span class="badge-alltime-freq" title="Total times this keyword appeared across all job postings scanned from the beginning">
            📊 In ${gap.frequency || 1} Openings
          </span>
          <span class="skill-demand-badge">
            Demand: ${escapeHTML(gap.demand || 'High')}
          </span>
        </div>

        <!-- GCC COUNTRY DEMAND -->
        ${hasGcc ? `
          <div class="badge-gcc-demand" title="GCC roles specifically requesting this skill">
            🌍 <strong>High GCC Demand:</strong> ${escapeHTML(gccList.join(', '))}
          </div>
        ` : ''}

        <!-- WHY IT MATTERS -->
        <p style="font-size: 13px; color: #334155; line-height: 1.45; margin: 2px 0;">
          ${escapeHTML(gap.why_it_matters || 'Requested in target market postings to complement SQL/Excel stack.')}
        </p>

        <!-- RECOMMENDED PORTFOLIO PROJECT -->
        <div class="roadmap-box">
          <div class="roadmap-title">🎯 Recommended Portfolio Project:</div>
          <div style="color: #475569;">${escapeHTML(gap.recommended_project || 'Build a showcase analytical template.')}</div>
        </div>

        <!-- 1-CLICK ACTION BUTTONS -->
        <div class="skill-action-buttons">
          <a 
            href="${chatGptUrl}" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="btn-chatgpt" 
            title="Open ChatGPT with coaching prompt automatically filled in the chat box"
          >
            🤖 Ask ChatGPT
          </a>
          <a 
            href="${ytUrl}" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="btn-youtube" 
            title="Search top-rated video tutorials and courses on YouTube"
          >
            ▶️ YouTube Course
          </a>
        </div>

      </div>
    `;
  }).join('');
}

function showToast(message) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = message;
  toast.classList.add('show');
  
  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 4500);
}

function copyCoverLetter() {
  const text = document.getElementById('modal-cover-letter').value;
  navigator.clipboard.writeText(text);
  alert('Cover letter copied to clipboard!');
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendDailyDigestEmail() {
  const btn = document.getElementById('send-digest-btn');
  const originalText = btn.innerHTML;
  btn.innerHTML = `Sending...`;
  btn.disabled = true;

  try {
    const res = await fetch('/api/send-digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: 'aksamakbar@gmail.com' })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ ${data.message}\n\nJobs included: ${data.job_count}\nRecipient: ${data.recipient}\n\nYou can also click "Preview 9 AM Digest" to view the rendered email digest.`);
    } else {
      alert(`⚠️ Notice: ${data.message}\n\nThe HTML email digest was saved locally.`);
    }
  } catch (err) {
    alert('Error sending digest: ' + err.message);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

