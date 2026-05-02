// Full-tab API key setup (survives focus changes; toolbar popup alone does not).

const GEMINI_KEY_STORAGE = 'jobscout_gemini_key';
const SERPER_KEY_STORAGE = 'jobscout_serper_key';

const statusEl = () => document.getElementById('setup-status');

function setStatus(text, tone) {
  const el = statusEl();
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
  el.dataset.tone = tone || '';
}

async function loadKeys() {
  const stored = await chrome.storage.local.get([GEMINI_KEY_STORAGE, SERPER_KEY_STORAGE]);
  document.getElementById('gemini-key').value = stored[GEMINI_KEY_STORAGE] || '';
  document.getElementById('serper-key').value = stored[SERPER_KEY_STORAGE] || '';
}

async function saveKeys() {
  const gemini = document.getElementById('gemini-key').value.trim();
  const serper = document.getElementById('serper-key').value.trim();

  if (!gemini || !serper) {
    setStatus('Both keys are required.', 'bad');
    return;
  }

  await chrome.storage.local.set({
    [GEMINI_KEY_STORAGE]: gemini,
    [SERPER_KEY_STORAGE]: serper,
  });

  setStatus('Saved. Close this tab and open Job Scout on a LinkedIn job again.', 'good');
}

document.addEventListener('DOMContentLoaded', () => {
  loadKeys().catch((e) => console.warn('[Job Scout setup]', e));
  document.getElementById('save-keys-btn').addEventListener('click', saveKeys);
});
