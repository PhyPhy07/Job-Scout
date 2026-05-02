// content.js — scrapes job posting data from LinkedIn (logic in scrape-job-data.js)

function getJobData() {
  if (typeof globalThis.jobScoutExtractJobData === 'function') {
    return globalThis.jobScoutExtractJobData();
  }
  return { company: null, jobTitle: null, location: null };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getJobData') {
    sendResponse(getJobData());
  }
  return true;
});
