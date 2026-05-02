const analyseBtn = document.getElementById('analyseBtn');
const outputArea = document.getElementById('outputArea');
const outputBox = document.getElementById('outputBox');
const outputLabel = document.getElementById('outputLabel');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const loadingBarWrap = document.getElementById('loadingBarWrap');
const loadingBarFill = document.getElementById('loadingBarFill');
const loadingText = document.getElementById('loadingText');
const loadingPct = document.getElementById('loadingPct');
const copyBtn = document.getElementById('copyBtn');
const cachedBadge = document.getElementById('cachedBadge');

const MODE_LABELS = {
  summarise: 'Summary',
  eli5: 'Simple explanation',
  redflags: 'Red flags',
  keyfacts: 'Key facts',
  trustcheck: 'Trust check'
};

// Pages we can't inject into
const BLOCKED_SCHEMES = ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'data:'];

function isBlockedPage(url) {
  if (!url) return true;
  return BLOCKED_SCHEMES.some(scheme => url.startsWith(scheme));
}

// Cache key for current tab + mode combination
function cacheKey(url, mode) {
  // strip query params and hash for cleaner cache keys
  try {
    const u = new URL(url);
    return `cache:${u.origin}${u.pathname}:${mode}`;
  } catch {
    return `cache:${url}:${mode}`;
  }
}

async function getCached(url, mode) {
  const key = cacheKey(url, mode);
  return new Promise(resolve => {
    chrome.storage.local.get(key, result => {
      const entry = result[key];
      if (!entry) return resolve(null);
      // expire cache after 30 minutes
      if (Date.now() - entry.ts > 30 * 60 * 1000) {
        chrome.storage.local.remove(key);
        return resolve(null);
      }
      resolve(entry.text);
    });
  });
}

async function setCached(url, mode, text) {
  const key = cacheKey(url, mode);
  chrome.storage.local.set({ [key]: { text, ts: Date.now() } });
}

// Detect garbled output — very low space ratio or high non-ASCII content
function looksGarbled(text) {
  if (text.length < 40) return false;
  const spaces = (text.match(/ /g) || []).length;
  const spaceRatio = spaces / text.length;
  const nonAscii = (text.match(/[^\x20-\x7E]/g) || []).length;
  const nonAsciiRatio = nonAscii / text.length;
  return spaceRatio < 0.05 || nonAsciiRatio > 0.15;
}

// Render basic markdown to HTML
function renderMarkdown(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>(\n|$))+/g, match => '<ul>' + match + '</ul>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>');

  if (!html.includes('<ul>') && !html.includes('<li>')) {
    html = '<p>' + html + '</p>';
  }

  return html;
}

let selectedMode = 'summarise';
let isAnalysing = false;
let modelReady = false;
let streamBuffer = '';
let retryCount = 0;
let currentPageText = '';
let currentPageUrl = '';
let cursor = null;
let worker = null;

function startWorker() {
  worker = new Worker(chrome.runtime.getURL('ai_worker.js'), { type: 'module' });

  worker.onmessage = handleWorkerMessage;

  worker.onerror = (e) => {
    setStatus('error', 'error');
    console.error('[Plainly] Worker error:', e.message);
  };

  worker.postMessage({ type: 'LOAD' });
}

function handleWorkerMessage(e) {
  const { type } = e.data;

  if (type === 'LOADING') {
    const pct = e.data.progress ?? 0;
    loadingBarWrap.classList.add('visible');
    loadingBarFill.style.width = pct + '%';
    loadingPct.textContent = pct + '%';
    loadingText.textContent = pct < 5
      ? 'Downloading AI model (one time only)...'
      : 'Loading into memory...';
    setStatus('loading', pct + '%');
  }

  if (type === 'READY') {
    modelReady = true;
    loadingBarWrap.classList.remove('visible');
    setStatus('ready', 'ready');
    updateAnalyseBtn();
  }

  if (type === 'CHUNK') {
    streamBuffer += e.data.chunk;
    if (cursor) cursor.remove();
    outputBox.textContent = streamBuffer;
    cursor = document.createElement('span');
    cursor.className = 'cursor';
    outputBox.appendChild(cursor);
    outputBox.scrollTop = outputBox.scrollHeight;
  }

  if (type === 'DONE') {
    if (cursor) cursor.remove();
    cursor = null;

    if (looksGarbled(streamBuffer) && retryCount < 1) {
      retryCount++;
      streamBuffer = '';
      outputBox.textContent = '';
      cursor = document.createElement('span');
      cursor.className = 'cursor';
      outputBox.appendChild(cursor);
      worker.postMessage({ type: 'ANALYSE', text: currentPageText, mode: selectedMode });
      return;
    }

    retryCount = 0;
    outputBox.innerHTML = renderMarkdown(streamBuffer);
    setCached(currentPageUrl, selectedMode, streamBuffer);
    copyBtn.style.display = 'flex';
    resetBtn();
  }

  if (type === 'ERROR') {
    if (cursor) cursor.remove();
    cursor = null;
    showError('Something went wrong. Try again.');
    console.error('[Plainly]', e.data.error);
    resetBtn();
  }
}

function showError(msg) {
  outputArea.classList.add('visible');
  outputBox.innerHTML = `<div class="error-state">${msg}</div>`;
  copyBtn.style.display = 'none';
  cachedBadge.style.display = 'none';
}

function setStatus(state, text) {
  statusDot.className = 'status-dot ' + state;
  statusText.textContent = text;
}

function resetBtn() {
  isAnalysing = false;
  updateAnalyseBtn();
}

function updateAnalyseBtn() {
  if (!modelReady) {
    analyseBtn.disabled = true;
    analyseBtn.textContent = 'Loading model...';
  } else if (isAnalysing) {
    analyseBtn.disabled = true;
    analyseBtn.textContent = 'Analysing...';
  } else {
    analyseBtn.disabled = false;
    analyseBtn.textContent = 'Analyse this page';
  }
}

// Mode switching
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = btn.dataset.mode;
  });
});

// Copy button
copyBtn.addEventListener('click', () => {
  const text = streamBuffer || outputBox.innerText;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.classList.add('copied');
    copyBtn.querySelector('span') && (copyBtn.querySelector('span').textContent = 'copied!');
    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="20 6 9 17 4 12"/></svg> copied!`;
    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> copy`;
    }, 2000);
  });
});

// Analyse button
analyseBtn.addEventListener('click', async () => {
  if (isAnalysing || !modelReady) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (isBlockedPage(tab?.url)) {
    showError("Can't analyse this page. Try a regular website.");
    return;
  }

  isAnalysing = true;
  streamBuffer = '';
  retryCount = 0;
  currentPageUrl = tab.url;

  updateAnalyseBtn();
  outputArea.classList.add('visible');
  outputLabel.textContent = MODE_LABELS[selectedMode];
  outputBox.innerHTML = '';
  copyBtn.style.display = 'none';
  cachedBadge.style.display = 'none';

  // check cache first
  const cached = await getCached(tab.url, selectedMode);
  if (cached) {
    streamBuffer = cached;
    outputBox.innerHTML = renderMarkdown(cached);
    cachedBadge.style.display = 'flex';
    copyBtn.style.display = 'flex';
    resetBtn();
    return;
  }

  cursor = document.createElement('span');
  cursor.className = 'cursor';
  outputBox.appendChild(cursor);

  chrome.runtime.sendMessage({ type: 'GET_PAGE_TEXT', tabId: tab.id }, response => {
    if (chrome.runtime.lastError || !response?.success) {
      showError("Couldn't read this page. Try refreshing it first.");
      resetBtn();
      return;
    }

    if (!response.text || response.text.trim().length < 100) {
      showError("Not enough text on this page to analyse.");
      resetBtn();
      return;
    }

    currentPageText = response.text;
    worker.postMessage({ type: 'ANALYSE', text: currentPageText, mode: selectedMode });
  });
});

startWorker();
