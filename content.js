// content.js — scrapes job posting data from LinkedIn

function getJobData() {
  // Company name — try multiple selectors for robustness
  const companySelectors = [
    '.job-details-jobs-unified-top-card__company-name a',
    '.job-details-jobs-unified-top-card__company-name',
    '.jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name',
    '[data-test-job-card-company-name]',
    '.topcard__org-name-link',
    '.topcard__org-name'
  ];

  const jobTitleSelectors = [
    '.job-details-jobs-unified-top-card__job-title h1',
    '.jobs-unified-top-card__job-title h1',
    '.topcard__title',
    'h1.t-24'
  ];

  const locationSelectors = [
    '.job-details-jobs-unified-top-card__bullet',
    '.jobs-unified-top-card__bullet',
    '.topcard__flavor--bullet'
  ];

  let company = null;
  for (const selector of companySelectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent.trim()) {
      company = el.textContent.trim();
      break;
    }
  }

  let jobTitle = null;
  for (const selector of jobTitleSelectors) {
    const el = document.querySelector(selector);
    if (el && el.textContent.trim()) {
      jobTitle = el.textContent.trim();
      break;
    }
  }

  let location = null;
  const locationEl = document.querySelector(locationSelectors.join(', '));
  if (locationEl) location = locationEl.textContent.trim();

  return { company, jobTitle, location };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getJobData') {
    const data = getJobData();
    sendResponse(data);
  }
  return true;
});
