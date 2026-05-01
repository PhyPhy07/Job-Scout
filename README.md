# Job Scout — Chrome Extension

Research any company from a LinkedIn job posting. The good, the bad, the ugly.

## What it does
- Detects the company name from any LinkedIn job posting
- Runs 5 targeted web searches via Serper
- Synthesizes results with Gemini into a structured brief:
  - **Snapshot** — what the company actually is
  - **Where they're investing** — strategic priorities and budget signals
  - **The Good** — positive signals
  - **The Bad** — concerns worth knowing
  - **The Ugly** — red flags (layoffs, lawsuits, leadership chaos)
  - **Funding & financial health**
  - **Verdict** — APPLY / CAUTION / PASS

Results are cached per company so you're not burning API calls on repeat visits.

---

## Setup

### 1. Get your API keys
- **Gemini**: https://aistudio.google.com/app/apikey (free)
- **Serper**: https://serper.dev (free tier = 2,500 searches/month)

### 2. Load the extension in Chrome
1. Open Chrome → go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `job-scout-extension` folder
5. Pin the Job Scout icon to your toolbar

### 3. Add your icons (optional but nice)
Drop `icon16.png`, `icon48.png`, and `icon128.png` into the `/icons` folder.
Any simple icon works — or grab one from https://icons8.com/icons/set/search.

### 4. First use
- Navigate to any LinkedIn job posting
- Click the Job Scout extension icon
- Enter your Gemini and Serper API keys (stored locally, never sent anywhere except to those APIs)
- Hit **Scout This Company**

---

## Notes
- Works on `linkedin.com/jobs/*` URLs only
- LinkedIn occasionally updates their DOM — if company name isn't detected, try refreshing the job posting
- Results are cached by company name; click **Re-scout** to force a fresh pull
- To reset API keys, click the small "Reset keys" link at the bottom of the popup
