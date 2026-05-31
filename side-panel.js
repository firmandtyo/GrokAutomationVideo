// ══════════════════════════════════════════════
//  Grok Automation — Side Panel Controller
// ══════════════════════════════════════════════

let isRunning = false;
let shouldStop = false;
let logs = [];

// ── State ──
const state = {
  mode: 'text-to-image',
  concurrent: 1,
  delayMin: 2,
  delayMax: 5,
  prompts: [],
  outputsPerPrompt: 1,
  folder: 'Grok-Outputs',
  videoRes: '480p',
  videoDur: '6s',
  settings: {
    autoDownload: true,
    skipFailed: true,
    autoOpen: true,
    verbose: false,
    timeout: 120,
  },
};

// ── Load saved state ──
async function loadState() {
  const saved = await chrome.storage.local.get(['gaState']);
  if (saved.gaState) {
    Object.assign(state, saved.gaState);
    applyStateToUI();
  }
}

async function saveState() {
  await chrome.storage.local.set({ gaState: state });
}

// ── Apply loaded state to UI ──
function applyStateToUI() {
  document.getElementById('concurrentSelect').value = state.concurrent;
  document.getElementById('delayMin').value = state.delayMin;
  document.getElementById('delayMax').value = state.delayMax;
  document.getElementById('promptsArea').value = state.prompts.join('\n\n');
  document.getElementById('outputsSelect').value = state.outputsPerPrompt;
  document.getElementById('folderName').value = state.folder;
  document.getElementById('settingAutoDownload').checked = state.settings.autoDownload;
  document.getElementById('settingSkipFailed').checked = state.settings.skipFailed;
  document.getElementById('settingAutoOpen').checked = state.settings.autoOpen;
  document.getElementById('settingVerbose').checked = state.settings.verbose;
  document.getElementById('settingTimeout').value = state.settings.timeout;

  // mode buttons
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === state.mode);
  });
  updatePromptCount();
}

// ── TAB SWITCHING ──
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});

// ── MODE BUTTONS ──
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.mode = btn.dataset.mode;
    // Show/hide video options
    const isVideo = ['text-to-video','frame-to-video','ingredients'].includes(state.mode);
    document.getElementById('videoOptionsCard').style.display = isVideo ? 'block' : 'none';
    saveState();
  });
});

// ── VIDEO RESOLUTION ──
document.querySelectorAll('.res-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.res-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.videoRes = btn.dataset.res;
    saveState();
  });
});

// ── VIDEO DURATION ──
document.querySelectorAll('.dur-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.videoDur = btn.dataset.dur;
    saveState();
  });
});

// ── INPUTS ──
document.getElementById('concurrentSelect').addEventListener('change', e => {
  state.concurrent = parseInt(e.target.value);
  saveState();
});
document.getElementById('delayMin').addEventListener('input', e => {
  state.delayMin = parseFloat(e.target.value);
  saveState();
});
document.getElementById('delayMax').addEventListener('input', e => {
  state.delayMax = parseFloat(e.target.value);
  saveState();
});
document.getElementById('outputsSelect').addEventListener('change', e => {
  state.outputsPerPrompt = parseInt(e.target.value);
  saveState();
});
document.getElementById('folderName').addEventListener('input', e => {
  state.folder = e.target.value;
  saveState();
});
document.getElementById('promptsArea').addEventListener('input', () => {
  updatePromptCount();
  saveState();
});

// Settings
['autoDownload', 'skipFailed', 'autoOpen', 'verbose'].forEach(key => {
  const el = document.getElementById('setting' + key.charAt(0).toUpperCase() + key.slice(1));
  el.addEventListener('change', () => {
    state.settings[key] = el.checked;
    saveState();
  });
});
document.getElementById('settingTimeout').addEventListener('input', e => {
  state.settings.timeout = parseInt(e.target.value);
  saveState();
});

// ── PROMPT COUNT ──
function getPrompts() {
  const raw = document.getElementById('promptsArea').value.trim();
  if (!raw) return [];
  return raw.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
}

function updatePromptCount() {
  const prompts = getPrompts();
  const el = document.getElementById('promptCount');
  el.textContent = `${prompts.length} prompt${prompts.length !== 1 ? 's' : ''}`;
  el.style.color = prompts.length > 0 ? 'var(--accent)' : 'var(--text3)';
}

// ── IMPORT / CLEAR / COPY ──
document.getElementById('importBtn').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.txt,.csv';
  input.onchange = async e => {
    const file = e.target.files[0];
    const text = await file.text();
    const area = document.getElementById('promptsArea');
    // Try CSV (one per line) or blank-line separated
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    area.value = lines.join('\n\n');
    updatePromptCount();
    log('info', `Imported ${lines.length} prompts from ${file.name}`);
  };
  input.click();
});

document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('promptsArea').value = '';
  updatePromptCount();
  log('warn', 'Prompts cleared');
});

document.getElementById('copyBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('promptsArea').value);
  log('info', 'Prompts copied to clipboard');
});

// ── LOGGING ──
function pad2(n) { return String(n).padStart(2, '0'); }
function timestamp() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function log(type, message) {
  const entry = { type, message, time: timestamp() };
  logs.push(entry);

  const box = document.getElementById('logBox');
  const div = document.createElement('div');
  div.className = 'log-entry';
  div.innerHTML = `<span class="log-time">[${entry.time}]</span> <span class="log-${type}">${escapeHtml(message)}</span>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

document.getElementById('clearLogsBtn').addEventListener('click', () => {
  logs = [];
  document.getElementById('logBox').innerHTML = '';
  log('info', 'Logs cleared.');
});

document.getElementById('copyLogsBtn').addEventListener('click', () => {
  const text = logs.map(l => `[${l.time}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
  navigator.clipboard.writeText(text);
});

document.getElementById('exportLogsBtn').addEventListener('click', () => {
  const text = logs.map(l => `[${l.time}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `grok-automation-logs-${Date.now()}.txt`;
  a.click();
});

// Settings buttons
document.getElementById('exportSettingsBtn').addEventListener('click', () => {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'grok-automation-settings.json';
  a.click();
  log('info', 'Settings exported');
});

document.getElementById('clearStorageBtn').addEventListener('click', async () => {
  await chrome.storage.local.clear();
  log('warn', 'All saved data cleared');
});

// ── GROK TAB CHECK ──
// Wait for tab to finish loading — with hard timeout fallback
async function waitForTabLoad(tabId, maxMs = 10000) {
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      try { chrome.tabs.onUpdated.removeListener(listener); } catch(_) {}
      resolve();
    }, maxMs);

    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        try { chrome.tabs.onUpdated.removeListener(listener); } catch(_) {}
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function findOrOpenGrokTab() {
  // Look for existing /imagine tab
  let tabs = await chrome.tabs.query({ url: '*://grok.com/imagine*' });
  if (tabs.length > 0) {
    log('info', 'Found existing grok.com/imagine tab');
    return tabs[0];
  }

  // Check for any grok.com tab → inject navigation to /imagine
  tabs = await chrome.tabs.query({ url: '*://grok.com/*' });
  if (tabs.length > 0) {
    const tabId = tabs[0].id;
    log('info', 'Navigating existing Grok tab to /imagine...');
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => { window.location.href = 'https://grok.com/imagine'; }
      });
      await sleep(500);
      await waitForTabLoad(tabId, 12000);
      await sleep(2500);
    } catch(e) {
      await chrome.tabs.update(tabId, { url: 'https://grok.com/imagine' });
      await waitForTabLoad(tabId, 12000);
      await sleep(2500);
    }
    return tabs[0];
  }

  // No grok tab at all — open new one
  if (state.settings.autoOpen) {
    log('info', 'Membuka grok.com/imagine...');
    const tab = await chrome.tabs.create({ url: 'https://grok.com/imagine' });
    await waitForTabLoad(tab.id, 15000);
    await sleep(3000);
    return tab;
  }
  return null;
}

// Navigate tab to /imagine using scripting injection (most reliable)
// Includes retry logic, connection-loss detection, and editor verification
async function navigateToImagine(tabId, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Step 0: Verify the tab still exists
      let tabInfo;
      try {
        tabInfo = await chrome.tabs.get(tabId);
      } catch (e) {
        log('error', `Tab ${tabId} no longer exists.`);
        throw new Error('Tab closed');
      }

      // Step 1: Force full page reload to /imagine
      // Using chrome.tabs.update is more reliable than executeScript for navigation
      // because executeScript can fail if the page is in a broken/disconnected state
      log('info', `[Attempt ${attempt}/${maxRetries}] Navigating to /imagine...`);

      try {
        // First try executeScript (works when page is responsive)
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => { window.location.href = 'https://grok.com/imagine'; }
        });
      } catch (scriptErr) {
        // If executeScript fails, the page is likely in a broken state
        // Use chrome.tabs.update as fallback (always works)
        log('warn', `executeScript failed (${scriptErr.message}), using tabs.update fallback`);
        await chrome.tabs.update(tabId, { url: 'https://grok.com/imagine' });
      }

      // Step 2: Wait for the tab to start navigating
      await sleep(800);

      // Step 3: Wait for tab to finish loading (with generous timeout)
      await waitForTabLoad(tabId, 15000);

      // Step 4: Extra wait for React/TipTap editor to mount
      await sleep(3000);

      // Step 5: Verify page is actually ready by checking for the editor
      const editorReady = await verifyEditorReady(tabId);

      if (editorReady) {
        log('info', 'Tab ready at grok.com/imagine');
        return; // Success!
      }

      // Editor not found — check if page has connection error
      const hasError = await checkPageForErrors(tabId);
      if (hasError) {
        log('warn', `Connection loss detected on attempt ${attempt}. Force reloading...`);
        // Force a hard reload
        await chrome.tabs.update(tabId, { url: 'https://grok.com/imagine' });
        await sleep(1000);
        await waitForTabLoad(tabId, 15000);
        await sleep(4000);

        // Check editor again after hard reload
        const retryReady = await verifyEditorReady(tabId);
        if (retryReady) {
          log('info', 'Tab recovered after reload');
          return;
        }
      }

      // If we're not on the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const waitTime = attempt * 3000; // Increasing backoff: 3s, 6s, 9s
        log('warn', `Editor not ready. Retrying in ${waitTime / 1000}s...`);
        await sleep(waitTime);
      }

    } catch (err) {
      if (err.message === 'Tab closed') throw err;
      log('warn', `navigateToImagine attempt ${attempt} error: ${err.message}`);
      if (attempt < maxRetries) {
        await sleep(3000);
      }
    }
  }

  // All retries exhausted — last resort: force navigate and hope for the best
  log('warn', 'All navigation retries exhausted. Forcing final reload...');
  try {
    await chrome.tabs.update(tabId, { url: 'https://grok.com/imagine' });
    await sleep(2000);
    await waitForTabLoad(tabId, 15000);
    await sleep(5000);
  } catch (_) {}
}

// Verify that the TipTap editor is present and ready in the tab
async function verifyEditorReady(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Check for the editor element
        const editor =
          document.querySelector('[data-testid="chat-input"] div[contenteditable="true"]') ||
          document.querySelector('div.ProseMirror[contenteditable="true"]') ||
          document.querySelector('div.tiptap[contenteditable="true"]') ||
          document.querySelector('div[contenteditable="true"][data-placeholder]') ||
          [...document.querySelectorAll('div[contenteditable="true"]')].find(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 200 && rect.height > 10;
          });

        if (!editor) return { ready: false, reason: 'editor_not_found' };

        // Also check that submit button exists
        const submitBtn =
          document.querySelector('button[type="submit"][aria-label="Submit"]') ||
          document.querySelector('button[type="submit"]');

        if (!submitBtn) return { ready: false, reason: 'submit_not_found' };

        return { ready: true };
      }
    });

    if (results && results[0] && results[0].result) {
      const { ready, reason } = results[0].result;
      if (!ready) {
        log('warn', `Page not ready: ${reason}`);
      }
      return ready;
    }
    return false;
  } catch (e) {
    log('warn', `verifyEditorReady failed: ${e.message}`);
    return false;
  }
}

// Check if the page has connection errors or error states
async function checkPageForErrors(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const bodyText = document.body?.innerText || '';
        // Common Grok connection error indicators
        const errorPatterns = [
          'something went wrong',
          'failed to fetch',
          'network error',
          'connection lost',
          'try again',
          'reload',
          'server error',
          'too many requests',
          'rate limit',
          'unable to connect',
          'ERR_',
          'terjadi kesalahan',
        ];
        const lowerBody = bodyText.toLowerCase();
        for (const pattern of errorPatterns) {
          if (lowerBody.includes(pattern.toLowerCase())) {
            return { hasError: true, pattern };
          }
        }
        // Also check if the page is basically empty (failed to load)
        if (document.body && document.body.children.length < 3) {
          return { hasError: true, pattern: 'empty_page' };
        }
        return { hasError: false };
      }
    });

    if (results && results[0] && results[0].result) {
      if (results[0].result.hasError) {
        log('warn', `Page error detected: "${results[0].result.pattern}"`);
      }
      return results[0].result.hasError;
    }
    return false;
  } catch (e) {
    // If we can't even run a script, the page is definitely broken
    log('warn', `checkPageForErrors failed (page likely broken): ${e.message}`);
    return true;
  }
}

async function checkGrokTabStatus() {
  const tabs = await chrome.tabs.query({ url: '*://grok.com/imagine*' });
  const el = document.getElementById('grokStatus');
  if (tabs.length > 0) {
    el.textContent = '🟢 Grok.com active';
    el.style.color = 'var(--accent)';
  } else {
    el.textContent = '⚪ Not on Grok.com';
    el.style.color = 'var(--text3)';
  }
}

setInterval(checkGrokTabStatus, 3000);
checkGrokTabStatus();

// ── PROGRESS UI ──
function showProgress(done, total) {
  const card = document.getElementById('progressCard');
  card.classList.add('visible');
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressDone').textContent = `${done} done`;
  document.getElementById('progressTotal').textContent = `of ${total}`;
  document.getElementById('progressPct').textContent = pct + '%';
}

function setStatus(text, dotClass = 'green') {
  document.getElementById('statusText').textContent = text;
  const dot = document.getElementById('statusDot');
  dot.className = 'status-dot ' + dotClass;
}

function hideProgress() {
  document.getElementById('progressCard').classList.remove('visible');
}

// ── SLEEP ──
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay() {
  const min = state.delayMin * 1000;
  const max = state.delayMax * 1000;
  return sleep(min + Math.random() * (max - min));
}

// ── START / STOP ──
document.getElementById('startBtn').addEventListener('click', async () => {
  if (isRunning) {
    shouldStop = true;
    setStatus('Stopping...', 'red');
    log('warn', 'Stop requested — finishing current prompt...');
    return;
  }
  await startAutomation();
});

async function startAutomation() {
  const prompts = getPrompts();
  if (prompts.length === 0) {
    log('error', 'No prompts found! Add prompts separated by blank lines.');
    return;
  }

  let tab = await findOrOpenGrokTab();
  if (!tab) {
    log('error', 'No grok.com tab found and auto-open is disabled.');
    return;
  }

  isRunning = true;
  shouldStop = false;
  const btn = document.getElementById('startBtn');
  btn.className = 'start-btn running';
  btn.innerHTML = '<span>⏹</span> <span>Stop Automation</span>';

  log('success', `Starting automation: ${prompts.length} prompts, mode: ${state.mode}`);
  showProgress(0, prompts.length);
  setStatus('Starting automation...');

  let done = 0;
  let failed = 0;

  for (let i = 0; i < prompts.length; i++) {
    if (shouldStop) {
      log('warn', `Stopped at prompt ${i + 1}/${prompts.length}`);
      break;
    }

    const prompt = prompts[i];
    setStatus(`Processing prompt ${i + 1}/${prompts.length}...`);
    log('info', `[${i + 1}/${prompts.length}] → "${prompt.substring(0, 60)}${prompt.length > 60 ? '...' : ''}"`);

    try {
      for (let o = 0; o < state.outputsPerPrompt; o++) {
        if (shouldStop) break;
        if (o > 0) {
          log('info', `Output ${o + 1}/${state.outputsPerPrompt} for prompt ${i + 1}`);
          await randomDelay();
        }

        // Attempt to run the prompt, with one retry on submit-not-found
        let lastErr = null;
        for (let retryRun = 0; retryRun < 2; retryRun++) {
          try {
            await runPromptOnTab(tab.id, prompt, state.mode, o, state.videoRes, state.videoDur);
            lastErr = null;
            break; // success
          } catch (runErr) {
            lastErr = runErr;
            // If submit button not found or editor not found, try re-navigating
            if (runErr.message.includes('Submit tidak ditemukan') ||
                runErr.message.includes('Editor') ||
                runErr.message.includes('tidak ditemukan')) {
              if (retryRun === 0) {
                log('warn', `${runErr.message} — Re-navigating to /imagine and retrying...`);
                await navigateToImagine(tab.id);
                await sleep(2000);
              }
            } else {
              break; // Other errors, don't retry
            }
          }
        }
        if (lastErr) throw lastErr;
      }
      done++;
      log('success', `✓ Prompt ${i + 1} completed`);
    } catch (err) {
      failed++;
      log('error', `✗ Prompt ${i + 1} failed: ${err.message}`);
      if (!state.settings.skipFailed) break;
    }

    showProgress(done, prompts.length);

    if (i < prompts.length - 1 && !shouldStop) {
      const delaySec = (state.delayMin + Math.random() * (state.delayMax - state.delayMin)).toFixed(1);
      setStatus(`Waiting ${delaySec}s before next prompt...`);
      log('info', `Waiting ${delaySec}s...`);
      await randomDelay();

      // Navigate back to /imagine before next prompt
      setStatus(`[${i+2}/${prompts.length}] Navigating to grok.com/imagine...`);
      log('info', `Navigating to /imagine for prompt ${i+2}...`);

      try {
        await navigateToImagine(tab.id);

        // Double-check: verify editor is actually ready before proceeding
        const ready = await verifyEditorReady(tab.id);
        if (!ready) {
          log('warn', 'Editor still not ready after navigation. Waiting extra 5s...');
          await sleep(5000);
          const readyRetry = await verifyEditorReady(tab.id);
          if (!readyRetry) {
            log('error', 'Editor not available. Attempting full page reload...');
            await chrome.tabs.update(tab.id, { url: 'https://grok.com/imagine' });
            await sleep(2000);
            await waitForTabLoad(tab.id, 15000);
            await sleep(5000);
          }
        }

        log('success', `Ready for prompt ${i+2}`);
      } catch (navErr) {
        if (navErr.message === 'Tab closed') {
          log('error', 'Grok tab was closed! Attempting to reopen...');
          const newTab = await findOrOpenGrokTab();
          if (newTab) {
            tab = newTab;
            log('info', 'Reopened Grok tab');
            await sleep(3000);
          } else {
            log('error', 'Cannot reopen Grok tab. Stopping.');
            break;
          }
        } else {
          log('error', `Navigation failed: ${navErr.message}. Attempting recovery...`);
          // Try one more time with a fresh page load
          try {
            await chrome.tabs.update(tab.id, { url: 'https://grok.com/imagine' });
            await sleep(2000);
            await waitForTabLoad(tab.id, 15000);
            await sleep(5000);
          } catch (_) {
            log('error', 'Recovery failed. Stopping.');
            break;
          }
        }
      }
    }
  }

  isRunning = false;
  shouldStop = false;
  btn.className = 'start-btn idle';
  btn.innerHTML = '<span>▶</span> <span>Start Automation</span>';
  setStatus(`Done! ${done} succeeded, ${failed} failed`, failed > 0 ? 'red' : 'green');
  log('success', `Automation complete. ${done}/${prompts.length} succeeded.`);

  setTimeout(hideProgress, 5000);
}

// ── BUILD FILENAME SLUG FROM PROMPT ──
// Takes first ~50 chars of prompt, strips special chars, trims to safe filename
function makePromptSlug(prompt) {
  return prompt
    .trim()
    .substring(0, 50)           // max 50 chars
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_]/g, '')  // remove special chars
    .replace(/\s+/g, '_')       // spaces → underscores
    .replace(/_{2,}/g, '_')     // collapse multiple underscores
    .replace(/^_|_$/g, '')      // trim leading/trailing underscores
    || 'grok_output';
}

// ── INJECT PROMPT INTO GROK TAB ──
async function runPromptOnTab(tabId, prompt, mode, outputIndex, videoRes = '480p', videoDur = '6s') {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: injectGrokPrompt,
    args: [prompt, mode, outputIndex, state.settings.timeout * 1000, state.settings.autoDownload, state.folder, videoRes, videoDur, makePromptSlug(prompt)],
  });

  if (!results || results.length === 0) {
    throw new Error('Script injection failed or returned no result');
  }

  const result = results[0].result;
  if (result && result.error) {
    throw new Error(result.error);
  }

  if (state.settings.verbose) {
    log('info', `Script result: ${JSON.stringify(result)}`);
  }
}

// ── THIS FUNCTION RUNS INSIDE GROK.COM TAB ──
// Selectors based on ACTUAL grok.com HTML structure (contenteditable TipTap editor)
function injectGrokPrompt(prompt, mode, outputIndex, timeoutMs, autoDownload, folder, videoRes, videoDur, promptSlug) {
  return new Promise(async (resolve) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // Ensure promptSlug is safe (fallback if not passed)
    if (!promptSlug) {
      promptSlug = (prompt || 'grok_output')
        .trim().substring(0, 50).toLowerCase()
        .replace(/[^a-z0-9\s\-_]/g, '').replace(/\s+/g, '_')
        .replace(/_{2,}/g, '_').replace(/^_|_$/g, '') || 'grok_output';
    }

    async function waitFor(fn, ms = 20000, interval = 400) {
      const start = Date.now();
      while (Date.now() - start < ms) {
        const el = fn();
        if (el) return el;
        await sleep(interval);
      }
      return null;
    }

    // ── Grok uses TipTap/ProseMirror contenteditable, NOT a <textarea> ──
    // Selector: div[contenteditable="true"] inside [data-testid="chat-input"]
    function findEditor() {
      return (
        document.querySelector('[data-testid="chat-input"] div[contenteditable="true"]') ||
        document.querySelector('div.ProseMirror[contenteditable="true"]') ||
        document.querySelector('div.tiptap[contenteditable="true"]') ||
        document.querySelector('div[contenteditable="true"][data-placeholder]') ||
        // Fallback: any visible contenteditable
        [...document.querySelectorAll('div[contenteditable="true"]')].find(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 200 && rect.height > 10;
        }) || null
      );
    }

    // ── Type text into TipTap editor ──
    // Works even when browser is MINIMIZED — no execCommand/focus dependency
    async function typeIntoEditor(editor, text) {

      // ── METHOD 1: Clipboard paste (works minimized, most compatible) ──
      async function tryClipboardPaste() {
        try {
          // Write text to clipboard from within page context
          await navigator.clipboard.writeText(text);
          await sleep(100);

          // Focus editor silently (needed for paste target, but not for window focus)
          editor.focus({ preventScroll: true });
          await sleep(100);

          // Clear existing content first
          const sel = window.getSelection();
          if (sel) {
            sel.selectAllChildren(editor);
            await sleep(50);
          }

          // Dispatch paste event with the text as clipboard data
          const dt = new DataTransfer();
          dt.setData('text/plain', text);
          const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true, cancelable: true, clipboardData: dt
          });
          editor.dispatchEvent(pasteEvent);
          await sleep(200);

          // Verify
          const val = editor.innerText.replace(/
/g, '').trim();
          return val.length > 0;
        } catch (e) {
          return false;
        }
      }

      // ── METHOD 2: Direct ProseMirror/TipTap DOM mutation ──
      // Sets inner HTML and triggers all necessary events — works minimized
      async function tryDirectMutation() {
        try {
          // Clear editor
          editor.innerHTML = '<p></p>';
          await sleep(50);

          // Set content in ProseMirror paragraph format
          const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          editor.innerHTML = `<p>${escaped}</p>`;

          // Fire full event chain TipTap listens to
          editor.dispatchEvent(new Event('input',  { bubbles: true }));
          editor.dispatchEvent(new Event('change', { bubbles: true }));
          editor.dispatchEvent(new InputEvent('input', {
            bubbles: true, cancelable: true,
            inputType: 'insertText', data: text
          }));
          await sleep(200);

          const val = editor.innerText.replace(/
/g, '').trim();
          return val.length > 0;
        } catch (e) {
          return false;
        }
      }

      // ── METHOD 3: Keyboard event simulation per character ──
      // Slowest but most compatible fallback
      async function tryKeyEvents() {
        try {
          editor.focus({ preventScroll: true });
          // Clear first
          editor.innerHTML = '<p></p>';
          await sleep(50);

          // Type each character
          for (const char of text) {
            editor.dispatchEvent(new KeyboardEvent('keydown',  { key: char, bubbles: true }));
            editor.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
            editor.dispatchEvent(new InputEvent('beforeinput', { data: char, inputType: 'insertText', bubbles: true }));
            // Append char to DOM directly
            const p = editor.querySelector('p') || editor;
            p.textContent = (p.textContent || '') + char;
            editor.dispatchEvent(new InputEvent('input', { data: char, inputType: 'insertText', bubbles: true }));
            editor.dispatchEvent(new KeyboardEvent('keyup',  { key: char, bubbles: true }));
          }
          await sleep(200);
          return editor.innerText.trim().length > 0;
        } catch (e) {
          return false;
        }
      }

      // Try methods in order until one works
      let ok = false;

      ok = await tryClipboardPaste();
      if (!ok) ok = await tryDirectMutation();
      if (!ok) await tryKeyEvents();

      // Final verification & dispatch
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(150);
    }

    // ── Select generation mode (Image or Video) ──
    // aria-label="Generation mode" radiogroup
    async function selectMode(mode) {
      const radioGroup = document.querySelector('[role="radiogroup"][aria-label="Generation mode"]');
      if (!radioGroup) return;

      const isVideo = mode === 'text-to-video' || mode === 'frame-to-video' || mode === 'ingredients';
      const targetLabel = isVideo ? null : 'Image'; // null = Video (second button)

      const radios = [...radioGroup.querySelectorAll('button[role="radio"]')];
      // First button = Image, Second button = Video
      const targetBtn = isVideo ? radios[1] : radios[0];
      if (targetBtn && targetBtn.getAttribute('aria-checked') !== 'true') {
        targetBtn.click();
        await sleep(300);
      }
    }

    // ── Submit button: button[type="submit"][aria-label="Submit"] ──
    function findSubmitBtn() {
      return (
        document.querySelector('button[type="submit"][aria-label="Submit"]') ||
        document.querySelector('button[type="submit"]') ||
        [...document.querySelectorAll('button')].find(b =>
          (b.getAttribute('aria-label') || '').toLowerCase().includes('submit') && !b.disabled
        )
      );
    }

    // ── Count generated media (to detect NEW items after generation) ──
    function countMedia() {
      const imgs = [...document.querySelectorAll('img')].filter(i =>
        i.naturalWidth > 200 && i.naturalHeight > 200 &&
        !i.src.includes('avatar') && !i.src.includes('logo') &&
        !i.src.includes('icon') && !i.src.includes('profile') &&
        i.src !== '' && i.complete
      );
      const vids = [...document.querySelectorAll('video')].filter(v =>
        v.src || v.querySelector('source')?.src
      );
      return { imgs: imgs.length, vids: vids.length, imgEls: imgs, vidEls: vids };
    }

    // ── Detect if generation is in progress ──
    // Grok shows a submit button that becomes DISABLED while generating
    // Also uses SVG spinner circles with stroke-dashoffset animation
    function isGenerating() {
      const submitBtn = document.querySelector('button[type="submit"][aria-label="Submit"]');
      if (submitBtn && submitBtn.disabled) return true;

      // SVG circle spinner (stroke-dashoffset = animated)
      if (document.querySelector('circle[stroke-dashoffset]')) return true;
      if (document.querySelector('[class*="skeleton" i]')) return true;

      return false;
    }

    // ── Download helper ──
    async function downloadUrl(url, filename) {
      try {
        const resp = await fetch(url, { credentials: 'include' });
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl; a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
        await sleep(700);
      } catch (e) {
        // Fallback: direct link download
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        await sleep(700);
      }
    }

    // ── Select video resolution (480p / 720p) ──
    async function selectResolution(res) {
      const group = document.querySelector('[role="radiogroup"][aria-label="Video resolution"]');
      if (!group) return;
      const btns = [...group.querySelectorAll('button[role="radio"]')];
      const target = btns.find(b => b.textContent.trim() === res);
      if (target && target.getAttribute('aria-checked') !== 'true') {
        target.click(); await sleep(200);
      }
    }

    // ── Select video duration (6s / 10s) ──
    async function selectDuration(dur) {
      const group = document.querySelector('[role="radiogroup"][aria-label="Video duration"]');
      if (!group) return;
      const btns = [...group.querySelectorAll('button[role="radio"]')];
      const target = btns.find(b => b.textContent.trim() === dur);
      if (target && target.getAttribute('aria-checked') !== 'true') {
        target.click(); await sleep(200);
      }
    }

    try {
      // ─── STEP 1: Wait for editor to appear ───
      const editor = await waitFor(findEditor, 15000);
      if (!editor) {
        resolve({ error: '❌ Editor "Type to imagine" tidak ditemukan. Pastikan halaman grok.com sudah terbuka dan termuat penuh.' });
        return;
      }

      // ─── STEP 2: Set generation mode ───
      await selectMode(mode);

      // ─── STEP 2b: Set resolution & duration for video ───
      const isVideo = mode === 'text-to-video' || mode === 'frame-to-video' || mode === 'ingredients';
      if (isVideo) {
        await selectResolution(videoRes || '480p');
        await selectDuration(videoDur || '6s');
      }

      // ─── STEP 3: Type prompt into editor ───
      await typeIntoEditor(editor, prompt);
      await sleep(400);

      // ─── STEP 4: Verify text is there ───
      const currentText = editor.innerText.trim();
      if (!currentText) {
        resolve({ error: '❌ Gagal memasukkan teks ke editor. Coba refresh halaman grok.com.' });
        return;
      }

      // ─── STEP 5: Snapshot media count BEFORE submit ───
      const before = countMedia();

      // ─── STEP 6: Click Submit ───
      // Works minimized: dispatchEvent is not affected by window focus
      const submitBtn = findSubmitBtn();
      if (!submitBtn) {
        resolve({ error: '❌ Tombol Submit tidak ditemukan.' });
        return;
      }

      // Try multiple click methods — all work when minimized
      submitBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      await sleep(300);
      try { submitBtn.click(); } catch(_) {}
      await sleep(1200);

      // ─── STEP 7: Wait for generation to START ───
      // Signal: submit button becomes disabled OR download button not yet visible
      const dlBtnsBefore = document.querySelectorAll('button[aria-label="Download"]').length;
      let generationStarted = false;
      const startWait = Date.now();
      while (Date.now() - startWait < 8000) {
        if (isGenerating()) { generationStarted = true; break; }
        await sleep(300);
      }

      // ─── STEP 8: Wait for generation to FINISH ───
      // Primary signal: a NEW button[aria-label="Download"] appears in the DOM
      // Secondary signal: submit button re-enabled + media count changed
      const genStart = Date.now();
      while (Date.now() - genStart < timeoutMs) {
        const generating = isGenerating();
        const dlBtnsNow = document.querySelectorAll('button[aria-label="Download"]').length;
        const newDlBtn = dlBtnsNow > dlBtnsBefore; // new download button appeared!

        // Done when: new Download button appeared (most reliable signal)
        const done = newDlBtn || (generationStarted && !generating);

        if (done) {
          await sleep(800); // let last frame render

          const after = countMedia();
          const newImgs = after.imgs - before.imgs;
          const newVids = after.vids - before.vids;

          // ─── STEP 9: Download with filename from prompt ───
          let downloadCount = 0;
          if (autoDownload) {
            const allDlBtns = [...document.querySelectorAll('button[aria-label="Download"]')];
            const countNew = Math.max(newImgs + newVids, 1);
            const toClick = allDlBtns.slice(-countNew);

            for (let di = 0; di < toClick.length; di++) {
              const btn = toClick[di];

              // ── Find media URL near this download button ──
              let mediaUrl = null;
              let el = btn;
              for (let depth = 0; depth < 10 && !mediaUrl; depth++) {
                el = el.parentElement;
                if (!el) break;
                const vid = el.querySelector('video');
                const img = el.querySelector('img[src]:not([src=""])');
                if (vid && vid.src) mediaUrl = vid.src;
                else if (vid && vid.querySelector('source')?.src) mediaUrl = vid.querySelector('source').src;
                else if (img && img.naturalWidth > 200) mediaUrl = img.src;
              }

              const suffix = toClick.length > 1 ? `_${di + 1}` : '';

              if (mediaUrl) {
                // Fetch + Blob — works 100% when browser is minimized
                // No DOM focus or window visibility required
                try {
                  const resp = await fetch(mediaUrl, { credentials: 'include' });
                  const blob = await resp.blob();
                  const isVid = blob.type.includes('video') || mediaUrl.includes('.mp4');
                  const ext = isVid ? 'mp4' : (blob.type.includes('webp') ? 'webp' : 'jpg');
                  const filename = `${promptSlug}${suffix}.${ext}`;

                  const blobUrl = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = blobUrl;
                  a.download = filename;
                  a.style.display = 'none';
                  document.body.appendChild(a);
                  a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                  await sleep(300);
                  document.body.removeChild(a);
                  setTimeout(() => URL.revokeObjectURL(blobUrl), 8000);
                  downloadCount++;
                  await sleep(700);
                } catch (fetchErr) {
                  // Fallback: native button via dispatchEvent (minimized-safe)
                  btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                  downloadCount++;
                  await sleep(900);
                }
              } else {
                // No URL found — native button via dispatchEvent (minimized-safe)
                btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                try { btn.click(); } catch(_) {}
                downloadCount++;
                await sleep(900);
              }
            }
          }

          resolve({ success: true, newImages: newImgs, newVideos: newVids, downloaded: downloadCount });
          return;
        }

        await sleep(800);
      }

      // Timeout — generation may still be running
      resolve({ error: `⏱ Timeout ${timeoutMs / 1000}s. Generasi mungkin masih berjalan.` });

    } catch (err) {
      resolve({ error: '🔥 Error: ' + err.message });
    }
  });
}

// ── INIT ──
loadState();
log('info', 'Grok Automation loaded. Open grok.com and add prompts to begin.');
