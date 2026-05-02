// Shared LinkedIn jobs scraper. Runs in the extension isolated world.
// Prefer JSON-LD JobPosting (authoritative) + scoped DOM; never trust the first /company/ link on the whole page.

(function registerJobScoutScrape() {
  'use strict';

  function scrapeDebug(...args) {
    if (!globalThis.__JOB_SCOUT_SCRAPE_DEBUG) return;
    console.log('[Job Scout · scrape]', ...args);
  }

  function normalizeSpace(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
  }

  /** Reject partner sites and noisy UI strings (substring match, not only exact). */
  function isGarbageCompanyLabel(t) {
    if (!t || t.length < 2) return true;
    if (/glassdoor|indeed\.com|levels\.fy|\bblind\b|builtin\b|comparably|salary\.com/i.test(t)) return true;
    if (/^see\s+/i.test(t) || /^view\s+/i.test(t) || /^reviews?\s+on\s+/i.test(t)) return true;
    return false;
  }

  function anchorVisibleLabel(a) {
    let t = normalizeSpace(a.textContent);
    if (t.length >= 2 && !isGarbageCompanyLabel(t)) return t;
    t = normalizeSpace(a.getAttribute('aria-label') || '');
    if (t.length >= 2 && !isGarbageCompanyLabel(t)) return t;
    const img = a.querySelector('img[alt]');
    if (img) {
      t = normalizeSpace(img.getAttribute('alt') || '');
      if (t.length >= 2 && !isGarbageCompanyLabel(t)) return t;
    }
    return '';
  }

  const DETAIL_ROOT_ORDER = [
    ['.job-details-jobs-unified-top-card', () => document.querySelector('.job-details-jobs-unified-top-card')],
    [
      '.jobs-unified-job-details-pane .jobs-unified-top-card',
      () => document.querySelector('.jobs-unified-job-details-pane .jobs-unified-top-card'),
    ],
    ['.jobs-unified-job-details-pane', () => document.querySelector('.jobs-unified-job-details-pane')],
    ['.jobs-search__job-details--container', () => document.querySelector('.jobs-search__job-details--container')],
    ['.scaffold-layout__detail', () => document.querySelector('.scaffold-layout__detail')],
    [
      'main .jobs-search__job-details--container',
      () => document.querySelector('main .jobs-search__job-details--container'),
    ],
  ];

  function detailTopCardRoot() {
    for (const [label, fn] of DETAIL_ROOT_ORDER) {
      const el = fn();
      if (el) {
        scrapeDebug('detail pane root:', label);
        return el;
      }
    }
    scrapeDebug('detail pane root: (none matched — company/title scraping may fail)');
    return null;
  }

  /** Collect JobPosting nodes from JSON-LD (handles @graph and nested arrays). */
  function walkJsonLd(node, out) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((n) => walkJsonLd(n, out));
      return;
    }
    if (node['@graph']) walkJsonLd(node['@graph'], out);
    const types = node['@type'];
    const typeList = Array.isArray(types) ? types : types != null ? [types] : [];
    const isJob = typeList.some((t) => String(t).toLowerCase() === 'jobposting');
    if (isJob) out.push(node);
    for (const k of Object.keys(node)) {
      if (k === '@context' || k === '@type') continue;
      walkJsonLd(node[k], out);
    }
  }

  function collectJobPostingsFromPage() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const postings = [];
    let parseFailures = 0;
    for (const script of scripts) {
      let data;
      try {
        data = JSON.parse(script.textContent);
      } catch {
        parseFailures++;
        continue;
      }
      walkJsonLd(data, postings);
    }
    scrapeDebug(
      `JSON-LD: ${scripts.length} script tag(s), ${parseFailures} parse failure(s), ${postings.length} JobPosting node(s)`
    );
    return postings;
  }

  function companyFromJsonLd(expectedTitleNorm, postings) {
    if (!postings.length) return null;

    const normTitle = expectedTitleNorm && normalizeSpace(expectedTitleNorm);

    function scorePosting(job) {
      let s = 0;
      const jt = normalizeSpace(job.title || job.name || '');
      if (normTitle && jt && jt === normTitle) s += 4;

      try {
        const jobUrl =
          typeof job.url === 'string'
            ? job.url
            : Array.isArray(job.url)
              ? job.url[0]
              : job.identifier?.url;
        const href = (window.location.href || '').replace(/\?.*$/, '');
        if (jobUrl && typeof jobUrl === 'string' && jobUrl.replace(/\?.*$/, '') === href) s += 5;
      } catch (_) {
        /* ignore */
      }

      const org = job.hiringOrganization;
      let name = null;
      if (org && typeof org === 'object') name = Array.isArray(org.name) ? org.name[0] : org.name;
      else if (typeof org === 'string') name = org;
      name = normalizeSpace(name || '');
      if (!name || isGarbageCompanyLabel(name)) return -1;

      const sameAs = org && typeof org === 'object' ? org.sameAs : null;
      const sas = typeof sameAs === 'string' ? [sameAs] : Array.isArray(sameAs) ? sameAs : [];
      if (sas.some((u) => /linkedin\.com\/company\//i.test(u || ''))) s += 2;

      return s;
    }

    let bestName = null;
    let bestScore = -1;
    for (const job of postings) {
      const org = job.hiringOrganization;
      let name = null;
      if (org && typeof org === 'object') name = Array.isArray(org.name) ? org.name[0] : org.name;
      else if (typeof org === 'string') name = org;
      name = normalizeSpace(name || '');
      if (!name || isGarbageCompanyLabel(name)) continue;

      const sc = scorePosting(job);
      if (sc > bestScore) {
        bestScore = sc;
        bestName = name;
      }
    }

    /** If scoring didn't help (all score 0), use the posting that matches title; else last valid name */
    if (bestScore <= 0 && normTitle) {
      for (const job of postings) {
        const jt = normalizeSpace(job.title || job.name || '');
        if (!jt || jt !== normTitle) continue;
        const org = job.hiringOrganization;
        let name =
          org && typeof org === 'object'
            ? normalizeSpace(
                (Array.isArray(org.name) ? org.name[0] : org.name) || ''
              )
            : typeof org === 'string'
              ? normalizeSpace(org)
              : '';
        if (name && !isGarbageCompanyLabel(name)) {
          scrapeDebug('JSON-LD pick: exact title match →', name);
          return name;
        }
      }
    }

    if (bestName) {
      scrapeDebug('JSON-LD pick: scoring →', { bestName, bestScore });
      return bestName;
    }

    /** Single JobPosting blob — LinkedIn sometimes embeds one */
    const withOrg = postings.filter((job) => {
      const org = job.hiringOrganization;
      let name =
        org && typeof org === 'object'
          ? Array.isArray(org.name)
            ? org.name[0]
            : org.name
          : typeof org === 'string'
            ? org
            : '';
      name = normalizeSpace(name || '');
      return name && !isGarbageCompanyLabel(name);
    });
    if (withOrg.length === 1) {
      const org = withOrg[0].hiringOrganization;
      let n =
        org && typeof org === 'object'
          ? Array.isArray(org.name)
            ? org.name[0]
            : org.name
          : typeof org === 'string'
            ? org
            : '';
      scrapeDebug('JSON-LD pick: sole JobPosting with org →', normalizeSpace(n || ''));
      return normalizeSpace(n || '');
    }

    scrapeDebug('JSON-LD: no company chosen (ambiguous or filtered)');
    return null;
  }

  function debugLogDomCompanyCandidates(root, label) {
    if (!globalThis.__JOB_SCOUT_SCRAPE_DEBUG || !root) return;
    const preferSelectors =
      '.job-details-jobs-unified-top-card__company-name a[href*="/company/"], .jobs-unified-top-card__company-name a[href*="/company/"]';
    const preferLinks = Array.from(root.querySelectorAll(preferSelectors));
    const summarize = (a, i) => ({
      i,
      href: (a.getAttribute('href') || '').slice(0, 120),
      text: normalizeSpace(a.textContent).slice(0, 80),
      aria: (a.getAttribute('aria-label') || '').slice(0, 80),
    });
    scrapeDebug(`${label}: “preferred” /company links (${preferLinks.length})`, preferLinks.map(summarize));
    const rest = Array.from(root.querySelectorAll('a[href*="/company/"]')).slice(0, 12);
    scrapeDebug(`${label}: first /company links in root (${rest.length} shown)`, rest.map(summarize));
  }

  function jobTitleSelectorUsed(root) {
    if (!root) return '(no root)';
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
      if (t) return s;
    }
    return '(no title matched)';
  }

  function companyFromRoot(root, label) {
    if (!root) return null;

    const preferSelectors = '.job-details-jobs-unified-top-card__company-name a[href*="/company/"], .jobs-unified-top-card__company-name a[href*="/company/"]';
    const preferLinks = Array.from(root.querySelectorAll(preferSelectors));
    for (const a of preferLinks) {
      const href = (a.getAttribute('href') || '').toLowerCase();
      if (!href.includes('/company/')) continue;
      if (href.includes('glassdoor') || href.includes('indeed')) continue;
      const lab = anchorVisibleLabel(a);
      if (!lab || isGarbageCompanyLabel(lab)) continue;
      scrapeDebug(`DOM pick [${label}]: preferred /company link →`, lab);
      return lab;
    }

    const allCompanyLinks = Array.from(root.querySelectorAll('a[href*="/company/"]'));
    for (const a of allCompanyLinks) {
      const href = (a.getAttribute('href') || '').toLowerCase();
      if (!href.includes('/company/')) continue;
      if (href.includes('glassdoor') || href.includes('indeed')) continue;
      const lab = anchorVisibleLabel(a);
      if (!lab || isGarbageCompanyLabel(lab)) continue;
      scrapeDebug(`DOM pick [${label}:fallback /company] →`, lab);
      return lab;
    }

    const blocks = [
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name',
      '.topcard__org-name-link',
      '.topcard__org-name',
    ];
    for (const sel of blocks) {
      const el = root.querySelector(sel);
      if (!el) continue;
      const onlyLinks = Array.from(el.querySelectorAll('a'));
      let bestLabel = '';
      for (const a of onlyLinks) {
        const href = (a.getAttribute('href') || '').toLowerCase();
        if (href.includes('/company/')) {
          const lab = anchorVisibleLabel(a);
          if (lab && !isGarbageCompanyLabel(lab)) {
            bestLabel = lab;
            break;
          }
        }
      }
      if (!bestLabel) {
        /** Strip known partner lines */
        let rawLines = normalizeSpace(el.textContent);
        rawLines = rawLines
          .replace(/\bglassdoor\b/gi, '')
          .replace(/\bindeed\b/gi, '')
          .trim();
        if (rawLines && !isGarbageCompanyLabel(rawLines)) bestLabel = rawLines;
      }
      if (bestLabel && !isGarbageCompanyLabel(bestLabel)) {
        scrapeDebug(`DOM pick [${label}:block ${sel}] →`, normalizeSpace(bestLabel));
        return normalizeSpace(bestLabel);
      }
    }

    scrapeDebug(`DOM pick [${label}]: no company`);
    return null;
  }

  function jobTitleFromRoot(root) {
    if (!root) return null;
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
    if (!root) return null;
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
    scrapeDebug('── extractJobData ──', 'href:', window.location.href);

    const root = detailTopCardRoot();

    /** Title first — used to pick the correct JobPosting when multiple ld+json blobs exist */
    const postings = collectJobPostingsFromPage();
    if (globalThis.__JOB_SCOUT_SCRAPE_DEBUG && postings.length) {
      const brief = postings.map((job, idx) => {
        const org = job.hiringOrganization;
        let on =
          org && typeof org === 'object'
            ? Array.isArray(org.name)
              ? org.name[0]
              : org.name
            : typeof org === 'string'
              ? org
              : '';
        return {
          idx,
          title: normalizeSpace(job.title || job.name || '').slice(0, 70),
          org: normalizeSpace(on || '').slice(0, 70),
          garbageOrg: on ? isGarbageCompanyLabel(normalizeSpace(on)) : null,
        };
      });
      scrapeDebug('JobPosting summaries (title / hiringOrganization):', brief);
    }

    const titleSel = jobTitleSelectorUsed(root);
    const jobTitle = jobTitleFromRoot(root);
    scrapeDebug('job title from DOM:', jobTitle || '(null)', '| first matching selector:', titleSel);

    if (globalThis.__JOB_SCOUT_SCRAPE_DEBUG) debugLogDomCompanyCandidates(root, 'primary root');

    let company =
      companyFromJsonLd(jobTitle, postings) || companyFromRoot(root, 'primary root');
    if (!company) {
      const pane = document.querySelector('.jobs-unified-job-details-pane');
      if (globalThis.__JOB_SCOUT_SCRAPE_DEBUG) debugLogDomCompanyCandidates(pane, 'details pane fallback');
      company = companyFromRoot(pane, 'details pane');
    }
    if (!company) company = companyFromJsonLd(null, postings);

    const out = {
      company,
      jobTitle,
      location: locationFromRoot(root),
    };
    scrapeDebug('→ result:', out);
    scrapeDebug(
      '(Open DevTools on this LinkedIn tab with debug on; popup logs separately as [Job Scout · popup])'
    );
    return out;
  };
})();
