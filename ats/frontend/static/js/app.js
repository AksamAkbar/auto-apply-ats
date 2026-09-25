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

  document.getElementById('modal-job-title').textContent = `${job.title} - ${job.company}`;
  document.getElementById('modal-job-location').textContent = job.location;
  document.getElementById('modal-job-desc').textContent = job.description;

  document.getElementById('modal-baseline-score').textContent = `${job.baseline_score}%`;
  document.getElementById('modal-tailored-score').textContent = `${job.tailored_score}%`;

  const kwContainer = document.getElementById('modal-keywords-box');
  kwContainer.innerHTML = `
    <div style="margin-bottom: 8px;">
      <strong style="font-size: 12px; color: #166534;">Matched Skills in Aksam's Profile:</strong>
      <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
        ${(job.matched_keywords || []).map(m => `<span class="keyword-badge keyword-matched">✓ ${m}</span>`).join('')}
      </div>
    </div>
    <div>
      <strong style="font-size: 12px; color: #92400e;">Keywords Addressed in Tailoring:</strong>
      <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
        ${(job.missing_keywords || []).map(m => `<span class="keyword-badge keyword-missing">${m}</span>`).join('')}
      </div>
    </div>
  `;

  // Fetch cover message
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

  // Setup Tailored Changes Banner & View Mode
  currentResumeViewMode = 'highlight'; // Default to highlight mode so user sees tailored changes immediately
  updateTailoredChangesBanner(job);

  // Load tailored resume preview iframe
  const resumeFilename = job.tailored_pdf_path ? job.tailored_pdf_path.replace('.pdf', '.html') : '';
  const isStatic = window.location.hostname.includes('github.io') || window.location.protocol === 'file:' || !window.location.port;
  const resumeUrl = isStatic ? `./resumes/${resumeFilename}` : `/api/resumes/${resumeFilename}`;
  const pdfDownloadUrl = isStatic ? `./resumes/${job.tailored_pdf_path}` : `/api/resumes/${job.tailored_pdf_path}?download=true`;

  const iframe = document.getElementById('resume-preview-frame');
  iframe.onload = () => {
    if (currentResumeViewMode === 'highlight') {
      applyHighlightsToIframe(iframe, currentModalJob);
    }
  };
  iframe.src = resumeUrl;

  // Set initial button active state
  const btnClean = document.getElementById('btn-cv-clean');
  const btnHighlight = document.getElementById('btn-cv-highlight');
  if (btnClean) btnClean.classList.remove('active');
  if (btnHighlight) btnHighlight.classList.add('active');

  // Populate absolute resume path for upload
  const resumePathInput = document.getElementById('copilot-resume-path');
  if (resumePathInput) {
    resumePathInput.value = `C:\\Users\\aksam\\Desktop\\aksamakbar-main\\ats\\storage\\resumes\\${job.tailored_pdf_path}`;
  }

  // Reset custom question box
  const qBox = document.getElementById('copilot-custom-question');
  if (qBox) qBox.value = '';
  const aBox = document.getElementById('copilot-answer-output');
  if (aBox) aBox.style.display = 'none';
  const cBtn = document.getElementById('copilot-copy-answer-btn');
  if (cBtn) cBtn.style.display = 'none';

  // Download PDF Link
  const dlBtn = document.getElementById('modal-download-cv');
  if (dlBtn) {
    dlBtn.href = pdfDownloadUrl;
  }

  // Open CV in New Tab Link
  const viewBtn = document.getElementById('modal-view-cv');
  if (viewBtn) {
    viewBtn.href = resumeUrl;
  }

  // Set direct portal link on Step 1 button
  const portalBtn = document.getElementById('modal-launch-portal-btn');
  if (portalBtn) {
    portalBtn.href = job.url || '#';
  }

  // Reset subview to Copilot
  switchModalPane('copilot');

  document.getElementById('review-modal').classList.add('open');
}

let currentResumeViewMode = 'highlight';

function updateTailoredChangesBanner(job) {
  const banner = document.getElementById('tailored-changes-banner');
  const pill = document.getElementById('tailored-score-pill');
  const list = document.getElementById('tailored-changes-list');
  if (!banner || !list) return;

  const matched = job.matched_keywords || [];
  const boost = Math.max(12, Math.round(job.tailored_score - (job.baseline_score || 72)));
  if (pill) pill.textContent = `ATS Match: ${job.tailored_score}% (+${boost}% Tailored Boost)`;

  list.innerHTML = `
    <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 8px; font-size: 11.5px;">
      <strong>🎯 Role Headline:</strong> <span>Target headline customized for <strong>${escapeHTML(job.title)}</strong></span>
      <strong>🏢 Company Summary:</strong> <span>Tailored professional summary synthesizing experience for <strong>${escapeHTML(job.company)}</strong></span>
      <strong>🔑 Injected Keywords:</strong> <span>${matched.slice(0, 7).map(m => `<span class="keyword-badge keyword-matched" style="font-size:10.5px; padding:1px 5px;">✓ ${escapeHTML(m)}</span>`).join(' ')}</span>
      <strong>🔥 Prioritized Bullets:</strong> <span>Re-ordered and scored project achievements matching recruiter requirements</span>
    </div>
  `;
  banner.style.display = currentResumeViewMode === 'highlight' ? 'block' : 'none';
}

function setResumeViewMode(mode) {
  currentResumeViewMode = mode;
  const btnClean = document.getElementById('btn-cv-clean');
  const btnHighlight = document.getElementById('btn-cv-highlight');
  const banner = document.getElementById('tailored-changes-banner');
  const iframe = document.getElementById('resume-preview-frame');

  if (btnClean) btnClean.classList.toggle('active', mode === 'clean');
  if (btnHighlight) btnHighlight.classList.toggle('active', mode === 'highlight');
  if (banner) banner.style.display = mode === 'highlight' ? 'block' : 'none';

  if (!iframe || !currentModalJob) return;

  if (mode === 'clean') {
    // Reload pristine resume
    const resumeFilename = currentModalJob.tailored_pdf_path ? currentModalJob.tailored_pdf_path.replace('.pdf', '.html') : '';
    const isStatic = window.location.hostname.includes('github.io') || window.location.protocol === 'file:' || !window.location.port;
    iframe.src = isStatic ? `./resumes/${resumeFilename}?clean=1` : `/api/resumes/${resumeFilename}?clean=1`;
  } else {
    applyHighlightsToIframe(iframe, currentModalJob);
  }
}

function applyHighlightsToIframe(iframe, job) {
  if (!iframe || !job) return;
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if (!doc || !doc.body) return;

    if (doc.getElementById('tailored-cv-injected-styles')) return;

    // 1. Inject Styles
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
      .tailored-item-highlight {
        border-left: 3px solid #16a34a !important;
        padding-left: 6px !important;
        background: #f0fdf4 !important;
      }
    `;
    doc.head.appendChild(style);

    // 2. Add badge to Subtitle
    const subtitle = doc.querySelector('.header .subtitle');
    if (subtitle && !subtitle.previousElementSibling?.classList.contains('tailored-badge')) {
      const badge = doc.createElement('div');
      badge.className = 'tailored-badge';
      badge.textContent = '🎯 Target Role Match';
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

function applyCopilotPreset(presetKey) {
  const input = document.getElementById('copilot-custom-question');
  if (!input) return;

  const presets = {
    notice: 'What is your official notice period and earliest joining date?',
    salary: 'What is your expected compensation / CTC for this role?',
    relocate: 'Are you willing to relocate or work on-site in this location?',
    why_hire: 'Why should we hire you for this role and what value will you deliver?',
    sql_bi: 'Describe your hands-on experience with SQL queries, data warehousing, and Power BI dashboards.',
    pricing: 'What is your experience in pricing analytics, variance reporting, and financial modeling?'
  };

  input.value = presets[presetKey] || '';
  askCopilotQuestion();
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

I have tailored my resume specifically to highlight relevant achievements for the ${title} role. I would welcome the opportunity to discuss how my analytical skill set and proactive approach can add immediate value to ${comp}.

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

