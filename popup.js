const enabledEl = document.getElementById('enabled');
const jobsUrlEl = document.getElementById('jobsUrl');
const keywordsEl = document.getElementById('keywords');
const intervalEl = document.getElementById('intervalMinutes');
const maxAgeEl = document.getElementById('maxAgeMinutes');
const maxBidsEl = document.getElementById('maxBids');
const recipientEmailEl = document.getElementById('recipientEmail');
const checkMessagesEl = document.getElementById('checkMessages');
const apiEndpointEl = document.getElementById('apiEndpoint');
const apiKeyEl = document.getElementById('apiKey');
const statusBox = document.getElementById('statusBox');
const recentList = document.getElementById('recentList');
const configForm = document.getElementById('configForm');
const checkNowBtn = document.getElementById('checkNowBtn');
const testEmailBtn = document.getElementById('testEmailBtn');

function renderStatus(status) {
  if (!status) {
    statusBox.className = 'status';
    statusBox.textContent = 'Ready. Click "Check Now" to initialize.';
    return;
  }
  statusBox.className = `status ${status.state || ''}`;
  const time = status.updatedAt ? new Date(status.updatedAt).toLocaleTimeString() : '';
  statusBox.textContent = `${status.message}${time ? ` (${time})` : ''}`;
}

function renderRecentJobs(jobs) {
  recentList.innerHTML = '';
  if (!Array.isArray(jobs) || jobs.length === 0) {
    const li = document.createElement('li');
    li.className = 'recent-meta';
    li.textContent = 'No jobs recorded yet.';
    recentList.appendChild(li);
    return;
  }

  for (const job of jobs) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = job.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = job.title;

    const meta = document.createElement('div');
    meta.className = 'recent-meta';
    meta.textContent = [job.budget, job.clientName, job.publishedAt].filter(Boolean).join(' · ') || 'IT & Programming';

    li.appendChild(a);
    li.appendChild(meta);
    recentList.appendChild(li);
  }
}

async function loadState() {
  const { config, status, recentJobs } = await chrome.storage.local.get(['config', 'status', 'recentJobs']);
  const c = config || {};
  enabledEl.checked = c.enabled !== false;
  jobsUrlEl.value = c.jobsUrl || 'https://www.workana.com/jobs?category=it-programming&language=xx&publication=1d';
  keywordsEl.value = c.keywords ?? 'php, mysql, javascript, typescript, html, css, database, sql, postgresql, mongodb, api, rest, graphql, responsive, web design, web development, android, react, react native, next.js, nextjs, node.js, nodejs, python, c++, electron, chatbot, shopify, web services, system analysis, it, crm, erp, full-stack, fullstack, backend, frontend, wordpress, woocommerce, automation, ai, saas';
  intervalEl.value = c.intervalMinutes || 2;
  maxAgeEl.value = c.maxAgeMinutes ?? 20;
  maxBidsEl.value = c.maxBids ?? 20;
  recipientEmailEl.value = c.recipientEmail || 'ivdamir65@gmail.com';
  checkMessagesEl.checked = c.checkMessages !== false;
  apiEndpointEl.value = c.apiEndpoint || 'https://amirence.com/api/job-alerts';
  apiKeyEl.value = c.apiKey || '';
  renderStatus(status);
  renderRecentJobs(recentJobs);
}

configForm.addEventListener('submit', (e) => {
  e.preventDefault();
  chrome.runtime.sendMessage(
    {
      type: 'SAVE_CONFIG',
      config: {
        enabled: enabledEl.checked,
        jobsUrl: jobsUrlEl.value.trim(),
        keywords: keywordsEl.value.trim(),
        intervalMinutes: Math.max(1, Math.min(30, Number(intervalEl.value) || 2)),
        maxAgeMinutes: Math.max(0, Math.min(1440, Number(maxAgeEl.value) || 0)),
        maxBids: Math.max(0, Math.min(200, Number(maxBidsEl.value) || 0)),
        recipientEmail: recipientEmailEl.value.trim(),
        checkMessages: checkMessagesEl.checked,
        apiEndpoint: apiEndpointEl.value.trim(),
        apiKey: apiKeyEl.value.trim(),
      },
    },
    () => {
      renderStatus({ state: 'ok', message: 'Settings saved.', updatedAt: new Date().toISOString() });
    },
  );
});

enabledEl.addEventListener('change', () => {
  configForm.requestSubmit();
});

checkNowBtn.addEventListener('click', () => {
  renderStatus({ state: '', message: 'Checking Workana...' });
  chrome.runtime.sendMessage({ type: 'CHECK_NOW' }, async () => {
    await loadState();
  });
});

testEmailBtn.addEventListener('click', () => {
  renderStatus({ state: '', message: 'Sending test email...' });
  chrome.runtime.sendMessage({ type: 'SEND_TEST_EMAIL' }, (res) => {
    if (res?.ok) {
      renderStatus({ state: 'ok', message: 'Test email sent successfully!', updatedAt: new Date().toISOString() });
    } else {
      renderStatus({ state: 'error', message: `Test email failed: ${res?.error || 'Unknown error'}` });
    }
  });
});

loadState();
