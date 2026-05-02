// Shared LinkedIn jobs scraper. Runs in the extension isolated world.
// IMPORTANT: Scoped to the open job detail card — never querySelector() the whole document
// for .jobs-unified-top-card_* or list cards will win and the company name will be wrong.

(function registerJobScoutScrape() {
  'use strict';

  function normalizeSpace(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
  }

  const JUNK_LABEL = /^(glassdoor|indeed|levels\.fy|blind|linkedin|see\s+reviews|reviews on glassdoor)$/i;

  function detailTopCardRoot() {
    return (
      document.querySelector('.job-details-jobs-unified-top-card') ||
      document.querySelector('.jobs-unified-job-details-pane .jobs-unified-top-card') ||
      document.querySelector('.jobs-unified-job-details-pane') ||
      document.querySelector('.jobs-search__job-details--container') ||
      document.querySelector('.scaffold-layout__detail') ||
      document.body
    );
  }

  function companyFromRoot(root) {
    if (!root) return null;

    const links = Array.from(root.querySelectorAll('a[href*="/company/"]'));
    for (const a of links) {
      const href = (a.getAttribute('href') || '').toLowerCase();
      if (!href.includes('/company/')) continue;
      if (href.includes('glassdoor') || href.includes('indeed.com')) continue;
      const label = normalizeSpace(a.textContent);
      if (label.length < 2 || JUNK_LABEL.test(label)) continue;
      return label;
    }

    const blocks = [
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
      '.topcard__org-name-link',
      '.topcard__org-name',
    ];
    for (const sel of blocks) {
      const el = root.querySelector(sel);
      const t = el && normalizeSpace(el.textContent);
      if (t && t.length >= 2 && !JUNK_LABEL.test(t)) return t;
    }
    return null;
  }

  function jobTitleFromRoot(root) {
    const sels = [
      '.job-details-jobs-unified-top-card__job-title h1',
      '.jobs-unified-top-card__job-title h1',
      'h1[data-test-job-title]',
      '.topcard__title',
      'h1.t-24',
    ];
    for (const s of sels) {
      const el = root.querySelector(s);
      const t = el && normalizeSpace(el.textContent);
      if (t) return t;
    }
    return null;
  }

  function locationFromRoot(root) {
    const sels = [
      '.job-details-jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__bullet',
      '.topcard__flavor--bullet',
    ];
    for (const s of sels) {
      const el = root.querySelector(s);
      const t = el && normalizeSpace(el.textContent);
      if (t) return t;
    }
    return null;
  }

  globalThis.jobScoutExtractJobData = function jobScoutExtractJobData() {
    const root = detailTopCardRoot();
    return {
      company: companyFromRoot(root),
      jobTitle: jobTitleFromRoot(root),
      location: locationFromRoot(root),
    };
  };
})();
