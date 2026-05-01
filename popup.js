// popup.js — Job Scout extension logic

const GEMINI_KEY_STORAGE = 'jobscout_gemini_key';
const SERPER_KEY_STORAGE = 'jobscout_serper_key';
const CACHE_STORAGE = 'jobscout_cache';

const app = document.getElementById('app');

// ─── State ───────────────────────────────────────────────────────────────────
let state = {
  view: 'checking', // checking | setup | idle | loading | results | error | not-linkedin
  company: null,
  jobTitle: null,
  results: null,
  error: null,
  loadingStep: '',
};

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  switch (state.view) {
    case 'checking':
      app.innerHTML = `<div class="content"><div class="loading-state"><div class="spinner"></div><p>Checking page...</p></div></div>`;
      break;

    case 'not-linkedin':
      app.innerHTML = `
        <div class="content">
          <div class="not-linkedin">
            <strong>⚠ Not a LinkedIn job posting</strong>
            <p>Navigate to a LinkedIn job posting and open Job Scout to research the company.</p>
          </div>
        </div>`;
      break;

    case 'setup':
      app.innerHTML = `
        <div class="content">
          <div class="idle-state">
            <div class="idle-icon">🔑</div>
            <h2>Almost there</h2>
            <p style="margin-bottom:16px">Add your API keys to get started. These are stored locally and never leave your browser.</p>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div>
              <label style="font-size:11px;font-family:'DM Mono',monospace;color:var(--muted);display:block;margin-bottom:4px">GEMINI API KEY</label>
              <input id="gemini-key" type="password" placeholder="AIza..." style="width:100%;padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:'DM Mono',monospace;font-size:12px;outline:none"/>
            </div>
            <div>
              <label style="font-size:11px;font-family:'DM Mono',monospace;color:var(--muted);display:block;margin-bottom:4px">SERPER API KEY</label>
              <input id="serper-key" type="password" placeholder="..." style="width:100%;padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:'DM Mono',monospace;font-size:12px;outline:none"/>
            </div>
            <button class="scout-btn" id="save-keys-btn">Save & Continue</button>
            <p style="font-size:11px;color:var(--muted);text-align:center">Get keys: <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--accent)">Gemini</a> · <a href="https://serper.dev" target="_blank" style="color:var(--accent)">Serper</a></p>
          </div>
        </div>`;

      document.getElementById('save-keys-btn').addEventListener('click', saveKeys);
      break;

    case 'idle':
      app.innerHTML = `
        <div class="company-bar">
          <div class="company-name">📍 ${state.company || 'Unknown Company'}</div>
          ${state.jobTitle ? `<div class="job-title-small">${state.jobTitle}</div>` : ''}
        </div>
        <div class="content">
          <div class="idle-state">
            <div class="idle-icon">🔍</div>
            <h2>Ready to scout</h2>
            <p>Get the full picture on <strong style="color:var(--text)">${state.company}</strong> — funding, culture, red flags, and where they're headed.</p>
            <button class="scout-btn" id="scout-btn">Scout This Company</button>
          </div>
        </div>
        <div class="settings-row">
          <span class="settings-label">API keys saved ✓</span>
          <span class="settings-link" id="reset-keys">Reset keys</span>
        </div>`;

      document.getElementById('scout-btn').addEventListener('click', runScout);
      document.getElementById('reset-keys').addEventListener('click', resetKeys);
      break;

    case 'loading':
      app.innerHTML = `
        <div class="company-bar">
          <div class="company-name">📍 ${state.company}</div>
        </div>
        <div class="content">
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Researching ${state.company}...</p>
            <div class="loading-step" id="loading-step">${state.loadingStep}</div>
          </div>
        </div>`;
      break;

    case 'results':
      const r = state.results;
      const verdictClass = r.verdict === 'APPLY' ? 'apply' : r.verdict === 'CAUTION' ? 'caution' : 'pass';
      const verdictEmoji = r.verdict === 'APPLY' ? '✅' : r.verdict === 'CAUTION' ? '⚠️' : '🚫';

      app.innerHTML = `
        <div class="company-bar">
          <div class="company-name">📍 ${state.company}</div>
          ${state.jobTitle ? `<div class="job-title-small">${state.jobTitle}</div>` : ''}
        </div>
        <div class="content">
          <div class="verdict ${verdictClass}">${verdictEmoji} ${r.verdict} — ${r.verdictReason}</div>

          <div class="section">
            <div class="section-header">
              <span class="section-icon">🏢</span>
              <span class="section-title">Snapshot</span>
            </div>
            <div class="section-body info">${r.snapshot}</div>
          </div>

          <div class="section">
            <div class="section-header">
              <span class="section-icon">📈</span>
              <span class="section-title">Where They're Investing</span>
            </div>
            <div class="section-body info">
              <ul class="bullet-list">${r.investing.map(i => `<li>${i}</li>`).join('')}</ul>
            </div>
          </div>

          <div class="section">
            <div class="section-header">
              <span class="section-icon">✅</span>
              <span class="section-title">The Good</span>
            </div>
            <div class="section-body good">
              <ul class="bullet-list">${r.good.map(i => `<li>${i}</li>`).join('')}</ul>
            </div>
          </div>

          <div class="section">
            <div class="section-header">
              <span class="section-icon">⚠️</span>
              <span class="section-title">The Bad</span>
            </div>
            <div class="section-body warn">
              <ul class="bullet-list">${r.bad.map(i => `<li>${i}</li>`).join('')}</ul>
            </div>
          </div>

          <div class="section">
            <div class="section-header">
              <span class="section-icon">🚨</span>
              <span class="section-title">The Ugly</span>
            </div>
            <div class="section-body bad">
              <ul class="bullet-list">${r.ugly.map(i => `<li>${i}</li>`).join('')}</ul>
            </div>
          </div>

          <div class="section">
            <div class="section-header">
              <span class="section-icon">💰</span>
              <span class="section-title">Funding & Financial Health</span>
            </div>
            <div class="section-body">${r.funding}</div>
          </div>

          <div class="divider"></div>
          <button class="rescan-btn" id="rescan-btn">↻ Re-scout this company</button>
        </div>
        <div class="settings-row">
          <span class="settings-label">Job Scout</span>
          <span class="settings-link" id="reset-keys">Reset keys</span>
        </div>`;

      document.getElementById('rescan-btn').addEventListener('click', () => runScout(true));
      document.getElementById('reset-keys').addEventListener('click', resetKeys);
      break;

    case 'error':
      app.innerHTML = `
        <div class="content">
          <div class="error-state">
            <strong>Something went wrong</strong>
            ${state.error}
          </div>
          <button class="scout-btn" id="retry-btn" style="margin-top:12px">Try Again</button>
        </div>`;
      document.getElementById('retry-btn').addEventListener('click', runScout);
      break;
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  render();

  // Check if we're on LinkedIn
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.url || !tab.url.includes('linkedin.com/jobs')) {
    state.view = 'not-linkedin';
    render();
    return;
  }

  // Try to scrape job data
  let jobData = { company: null, jobTitle: null };
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const companySelectors = [
          '.job-details-jobs-unified-top-card__company-name a',
          '.job-details-jobs-unified-top-card__company-name',
          '.jobs-unified-top-card__company-name a',
          '.topcard__org-name-link',
          '.topcard__org-name'
        ];
        const titleSelectors = [
          '.job-details-jobs-unified-top-card__job-title h1',
          '.jobs-unified-top-card__job-title h1',
          '.topcard__title',
          'h1.t-24'
        ];

        let company = null, jobTitle = null;
        for (const s of companySelectors) {
          const el = document.querySelector(s);
          if (el?.textContent.trim()) { company = el.textContent.trim(); break; }
        }
        for (const s of titleSelectors) {
          const el = document.querySelector(s);
          if (el?.textContent.trim()) { jobTitle = el.textContent.trim(); break; }
        }
        return { company, jobTitle };
      }
    });
    jobData = results[0]?.result || jobData;
  } catch (e) {
    console.warn('Scraping failed:', e);
  }

  state.company = jobData.company || 'this company';
  state.jobTitle = jobData.jobTitle;

  // Check for API keys
  const stored = await chrome.storage.local.get([GEMINI_KEY_STORAGE, SERPER_KEY_STORAGE]);
  if (!stored[GEMINI_KEY_STORAGE] || !stored[SERPER_KEY_STORAGE]) {
    state.view = 'setup';
  } else {
    state.view = 'idle';
  }

  render();
}

// ─── Keys ─────────────────────────────────────────────────────────────────────
async function saveKeys() {
  const gemini = document.getElementById('gemini-key').value.trim();
  const serper = document.getElementById('serper-key').value.trim();

  if (!gemini || !serper) {
    alert('Both keys are required.');
    return;
  }

  await chrome.storage.local.set({
    [GEMINI_KEY_STORAGE]: gemini,
    [SERPER_KEY_STORAGE]: serper,
  });

  state.view = 'idle';
  render();
}

async function resetKeys() {
  await chrome.storage.local.remove([GEMINI_KEY_STORAGE, SERPER_KEY_STORAGE, CACHE_STORAGE]);
  state.view = 'setup';
  state.results = null;
  render();
}

// ─── Scout ────────────────────────────────────────────────────────────────────
async function runScout(skipCache = false) {
  const stored = await chrome.storage.local.get([GEMINI_KEY_STORAGE, SERPER_KEY_STORAGE, CACHE_STORAGE]);
  const geminiKey = stored[GEMINI_KEY_STORAGE];
  const serperKey = stored[SERPER_KEY_STORAGE];
  const cache = stored[CACHE_STORAGE] || {};

  const cacheKey = state.company?.toLowerCase().trim();

  // Check cache (skip if re-scouting)
  if (!skipCache && cache[cacheKey]) {
    state.results = cache[cacheKey];
    state.view = 'results';
    render();
    return;
  }

  state.view = 'loading';
  render();

  try {
    // Step 1: Search queries
    const queries = [
      `${state.company} company news 2024 2025`,
      `${state.company} funding investment budget`,
      `${state.company} layoffs controversy problems`,
      `${state.company} glassdoor employee reviews culture`,
      `${state.company} company overview mission products`
    ];

    setLoadingStep('Searching the web...');
    const searchResults = await Promise.all(
      queries.map(q => serperSearch(q, serperKey))
    );

    // Flatten and deduplicate snippets
    const allSnippets = searchResults
      .flatMap(r => r.organic || [])
      .filter((item, idx, arr) => arr.findIndex(i => i.link === item.link) === idx)
      .slice(0, 20)
      .map(item => `SOURCE: ${item.title}\nURL: ${item.link}\nSNIPPET: ${item.snippet}`)
      .join('\n\n');

    setLoadingStep('Synthesizing with Gemini...');
    const report = await geminiSynthesize(state.company, state.jobTitle, allSnippets, geminiKey);

    // Cache the result
    cache[cacheKey] = report;
    await chrome.storage.local.set({ [CACHE_STORAGE]: cache });

    state.results = report;
    state.view = 'results';
    render();

  } catch (err) {
    console.error(err);
    state.error = err.message || 'Unknown error occurred.';
    state.view = 'error';
    render();
  }
}

function setLoadingStep(text) {
  state.loadingStep = text;
  const el = document.getElementById('loading-step');
  if (el) el.textContent = text;
}

// ─── Serper Search ────────────────────────────────────────────────────────────
async function serperSearch(query, apiKey) {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num: 5 }),
  });

  if (!res.ok) throw new Error(`Serper error: ${res.status} — check your Serper API key`);
  return res.json();
}

// ─── Gemini Synthesis ─────────────────────────────────────────────────────────
async function geminiSynthesize(company, jobTitle, searchSnippets, apiKey) {
  const prompt = `You are a job research analyst. A job seeker is considering applying to "${company}" for a "${jobTitle || 'software engineering'}" role. Based on the web search results below, create a concise but honest company brief.

Return ONLY valid JSON (no markdown, no backticks, no preamble) matching this exact structure:
{
  "verdict": "APPLY" | "CAUTION" | "PASS",
  "verdictReason": "one short sentence explaining the verdict",
  "snapshot": "2-3 sentence plain-English overview: what the company does, size/stage, industry",
  "investing": ["bullet 1 about strategic priorities", "bullet 2", "bullet 3"],
  "good": ["positive signal 1", "positive signal 2", "positive signal 3"],
  "bad": ["concern 1", "concern 2", "concern 3"],
  "ugly": ["red flag 1 or 'No major red flags found'", "red flag 2 if applicable"],
  "funding": "2-3 sentences on funding stage, investors, financial health, burn rate concerns if any"
}

Be honest and direct. If there's not enough info on a section, say so — don't invent. If the company is pre-launch or very small, note that transparency is limited.

SEARCH RESULTS:
${searchSnippets}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
      }),
    }
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Gemini error: ${res.status} — ${errData?.error?.message || 'check your Gemini API key'}`);
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Strip any accidental markdown fences
  const clean = raw.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    throw new Error('Gemini returned unexpected format. Try again.');
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
init();
