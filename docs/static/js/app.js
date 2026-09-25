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

  let prioTag = '';
  if (job.location_priority === 1) prioTag = '<span class="badge-priority">📍 Priority 1: Bengaluru</span>';
  else if (job.location_priority === 2) prioTag = '<span class="badge-priority">📍 Priority 2: Kerala</span>';
  else if (job.location_priority === 3) prioTag = '<span class="badge-priority">📍 Priority 3: Metro Hub</span>';
  else if (job.location_priority === 4) prioTag = '<span class="badge-priority">📍 Priority 4: GCC</span>';

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

  // Load tailored resume preview iframe
  const resumeFilename = job.tailored_pdf_path ? job.tailored_pdf_path.replace('.pdf', '.html') : '';
  const isStatic = window.location.hostname.includes('github.io') || window.location.protocol === 'file:' || !window.location.port;
  const resumeUrl = isStatic ? `./resumes/${resumeFilename}` : `/api/resumes/${resumeFilename}`;
  const pdfDownloadUrl = isStatic ? `./resumes/${job.tailored_pdf_path}` : `/api/resumes/${job.tailored_pdf_path}?download=true`;

  const iframe = document.getElementById('resume-preview-frame');
  iframe.src = resumeUrl;

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
  outArea.value = 'Generating tailored answer from Aksam\'s profile...';

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
  if (q.includes('notice') || q.includes('joining') || q.includes('availability') || q.includes('start')) {
    return 'My official notice period is 30 days (negotiable for earlier buyout/release if required).';
  }
  if (q.includes('salary') || q.includes('ctc') || q.includes('compensation') || q.includes('package')) {
    return 'My expected compensation is 6,00,000 INR (6 LPA), open to discussion based on company bands and role responsibilities.';
  }
  if (q.includes('relocat') || q.includes('location') || q.includes('hybrid') || q.includes('on-site')) {
    return `Yes, I am fully open and enthusiastic about relocating or working on-site in ${job.location || 'the job location'}.`;
  }
  if (q.includes('experience') || q.includes('years') || q.includes('background')) {
    return `I bring 1 to 2 years of hands-on analytical experience (MBA in Data Analytics, 2024), specializing in SQL data modeling, Power BI dashboard development, and Advanced Excel pricing analytics.`;
  }
  return `As an MBA in Data Analytics with expertise in SQL, Power BI, Advanced Excel, and Python, I bring strong problem-solving and quantitative modeling capabilities. I have proven experience at Allianze Infosoft conducting pricing analyses and building automated variance reports. I am confident in delivering high accuracy and immediate value for this ${job.title} role.`;
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

    container.innerHTML = gaps.map(gap => `
      <div class="skill-card">
        <div class="skill-card-top">
          <div class="skill-title">${escapeHTML(gap.skill_name)}</div>
          <span class="skill-category">${escapeHTML(gap.category)}</span>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px;">
          <span class="skill-demand-badge">Demand: ${escapeHTML(gap.demand)}</span>
          <span style="color: #64748b; font-weight: 600;">⏱️ Est: ${escapeHTML(gap.estimated_hours)}</span>
        </div>

        <p style="font-size: 13px; color: #334155; line-height: 1.4;">
          ${escapeHTML(gap.why_it_matters)}
        </p>

        <div class="roadmap-box">
          <div class="roadmap-title">🎯 Recommended Portfolio Project:</div>
          <div>${escapeHTML(gap.recommended_project)}</div>
        </div>

        <div style="margin-top: auto; padding-top: 10px; border-top: 1px solid #f1f5f9;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 4px;">LEARNING RESOURCES:</div>
          <ul style="font-size: 12px; color: #2563eb; margin-left: 16px;">
            ${(gap.learning_resources || []).map(r => `<li>${escapeHTML(r)}</li>`).join('')}
          </ul>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p>Error loading skill gaps: ${err.message}</p>`;
  }
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

