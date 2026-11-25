const ALARM_NAME = 'workana-job-poll';

const DEFAULT_KEYWORDS = [
  'php', 'mysql', 'javascript', 'typescript', 'html', 'css', 'database', 'sql',
  'postgresql', 'mongodb', 'api', 'rest', 'graphql', 'responsive', 'web design',
  'web development', 'android', 'react', 'react native', 'next.js', 'nextjs',
  'node.js', 'nodejs', 'python', 'c++', 'electron', 'chatbot', 'shopify',
  'web services', 'system analysis', 'it', 'crm', 'erp', 'full-stack', 'fullstack',
  'backend', 'frontend', 'wordpress', 'woocommerce', 'automation', 'ai', 'saas',
];

const DEFAULT_CONFIG = {
  enabled: true,
  checkMessages: true,
  intervalMinutes: 2,
  maxAgeMinutes: 20,
  maxBids: 20,
  // language=xx fetches all languages and all countries on Workana under IT & Programming.
  jobsUrl: 'https://www.workana.com/jobs?category=it-programming&language=xx&publication=1d',
  apiEndpoint: 'https://amirence.com/api/job-alerts',
  apiKey: '',
  recipientEmail: 'ivdamir65@gmail.com',
  keywords: DEFAULT_KEYWORDS.join(', '),
};

const MAX_SEEN_IDS = 500;
const MAX_RECENT_JOBS = 20;

async function getConfig() {
  const stored = await chrome.storage.local.get(['config']);
  return { ...DEFAULT_CONFIG, ...(stored.config || {}) };
}

async function setStatus(status) {
  await chrome.storage.local.set({
    status: {
      ...status,
      updatedAt: new Date().toISOString(),
    },
  });
}

async function scheduleAlarm(config) {
  await chrome.alarms.clear(ALARM_NAME);
  if (!config.enabled) return;
  const periodInMinutes = Math.max(1, Math.min(30, Number(config.intervalMinutes) || 2));
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: periodInMinutes,
    periodInMinutes,
  });
}

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html) {
  return decodeHtmlEntities(String(html || '').replace(/<[^>]*>/g, ' '));
}

function extractFullTitle(rawTitle) {
  const str = String(rawTitle || '');
  const attrMatch = str.match(/title="([^"]+)"/i);
  if (attrMatch) return decodeHtmlEntities(attrMatch[1]);
  return stripTags(str);
}

function parseBidCount(rawBids) {
  if (typeof rawBids === 'number' && Number.isFinite(rawBids)) return rawBids;
  const text = stripTags(String(rawBids || '')).toLowerCase();
  if (!text) return null;
  if (/no bids|sem propostas|sin propuestas|0\b/.test(text)) return 0;
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function parseAgeMinutes(postedText, publishedDate) {
  const text = String(postedText || '').toLowerCase().trim();
  if (text) {
    if (/just now|agora|ahora|recién|second|segundo|menos de (un|um|1) minut|less than a minute|a few seconds/.test(text)) {
      return 0;
    }
    if (/\b(a|an|one|un|um|uma)\s+minut/.test(text)) {
      return 1;
    }
    const minMatch = text.match(/(\d+)\s*(?:min|minut)/);
    if (minMatch) return parseInt(minMatch[1], 10);

    if (/\b(hour|hora|hr|day|dia|día|week|semana|month|mes|mês|yesterday|ontem|ayer)\b/.test(text)) {
      const hrMatch = text.match(/(\d+)\s*(?:hour|hora|hr)/);
      if (hrMatch) return parseInt(hrMatch[1], 10) * 60;
      return 60;
    }
  }

  if (publishedDate) {
    const parsed = Date.parse(publishedDate);
    if (!Number.isNaN(parsed)) {
      return Math.max(0, Math.round((Date.now() - parsed) / 60000));
    }
  }
  return null;
}

function passesAgeFilter(job, maxAgeMinutes) {
  const limit = Number(maxAgeMinutes);
  if (!Number.isFinite(limit) || limit <= 0) return true;
  if (job.ageMinutes === null || job.ageMinutes === undefined) return false;
  return job.ageMinutes <= limit;
}

function passesBidFilter(job, maxBids) {
  const limit = Number(maxBids);
  if (!Number.isFinite(limit) || limit <= 0) return true;
  if (job.bidCount === null || job.bidCount === undefined) return true;
  return job.bidCount <= limit;
}

function sortByPriority(jobs) {
  return [...jobs].sort((a, b) => {
    const aAge = a.ageMinutes ?? 9999;
    const bAge = b.ageMinutes ?? 9999;
    if (aAge !== bAge) return aAge - bAge;
    const aBids = a.bidCount ?? 999;
    const bBids = b.bidCount ?? 999;
    return aBids - bBids;
  });
}

function parseWorkanaJson(data) {
  const list = data?.results?.results || data?.results || [];
  if (!Array.isArray(list)) return [];

  return list
    .filter((item) => item && item.slug)
    .map((item) => {
      const skills = Array.isArray(item.skills)
        ? item.skills
            .map((s) => decodeHtmlEntities(typeof s === 'string' ? s : s?.anchorText || s?.name || ''))
            .filter(Boolean)
            .slice(0, 12)
        : [];

      const bidCount = parseBidCount(item.totalBids);
      const historyParts = [];
      if (bidCount !== null) historyParts.push(`${bidCount} bid${bidCount === 1 ? '' : 's'}`);
      if (item.hasVerifiedPaymentMethod) historyParts.push('Verified payment method');
      if (item.rating?.value) historyParts.push(`Rating ${item.rating.value}`);
      if (item.isHourly) historyParts.push('Hourly');

      const publishedAt = decodeHtmlEntities(item.postedDate || item.publishedDate || 'Just now');
      const ageMinutes = parseAgeMinutes(item.postedDate, item.publishedDate);

      return {
        id: String(item.slug),
        title: extractFullTitle(item.title),
        url: `https://www.workana.com/job/${item.slug}`,
        budget: decodeHtmlEntities(item.budget || ''),
        category: 'IT & Programming',
        publishedAt,
        ageMinutes,
        bidCount,
        skills,
        description: stripTags(item.description || item.shortDescription || '').slice(0, 500),
        clientName: decodeHtmlEntities(item.authorName || ''),
        clientCountry: stripTags(item.country || ''),
        clientHistory: historyParts.join(' · '),
      };
    });
}

function extractJobsFromHtml(html) {
  const jobs = [];
  const seenInPage = new Set();

  // Workana embeds job data in project-item cards and/or JSON props in the page HTML.
  // 1) Try structured JSON embedded in Vue/props first (richer client & skill details).
  const jsonJobRegex = /"slug"\s*:\s*"([a-z0-9-]+)"[\s\S]{0,1800}?"title"\s*:\s*"([^"]+)"/g;
  let m;
  while ((m = jsonJobRegex.exec(html)) !== null) {
    const slug = m[1];
    if (seenInPage.has(slug)) continue;
    const chunk = html.slice(m.index, m.index + 2400);
    const title = decodeHtmlEntities(m[2].replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))));
    if (!title || title.length < 4) continue;

    const budgetMatch = chunk.match(/"budget"\s*:\s*"([^"]+)"/);
    const descMatch = chunk.match(/"description"\s*:\s*"([^"]{10,800})"/);
    const authorMatch = chunk.match(/"authorName"\s*:\s*"([^"]+)"/) || chunk.match(/"name"\s*:\s*"([^"]+)"/);
    const countryMatch = chunk.match(/"country"\s*:\s*"([^"]+)"/);
    const postedMatch = chunk.match(/"postedDate"\s*:\s*"([^"]+)"/) || chunk.match(/"publishedDate"\s*:\s*"([^"]+)"/);

    const skills = [];
    const skillsBlock = chunk.match(/"skills"\s*:\s*\[([\s\S]{0,800}?)\]/);
    if (skillsBlock) {
      const skillRegex = /"anchorText"\s*:\s*"([^"]+)"|"name"\s*:\s*"([^"]+)"/g;
      let sm;
      while ((sm = skillRegex.exec(skillsBlock[1])) !== null) {
        skills.push(decodeHtmlEntities(sm[1] || sm[2]));
      }
    }

    seenInPage.add(slug);
    jobs.push({
      id: slug,
      title,
      url: `https://www.workana.com/job/${slug}`,
      budget: budgetMatch ? decodeHtmlEntities(budgetMatch[1]) : '',
      category: 'IT & Programming',
      publishedAt: postedMatch ? decodeHtmlEntities(postedMatch[1]) : 'Just now',
      skills: skills.slice(0, 12),
      description: descMatch ? stripTags(descMatch[1].replace(/\\n/g, ' ')).slice(0, 400) : '',
      clientName: authorMatch ? decodeHtmlEntities(authorMatch[1]) : '',
      clientCountry: countryMatch ? decodeHtmlEntities(countryMatch[1]) : '',
      clientHistory: '',
    });
  }

  // 2) Fallback: parse job links directly from HTML cards.
  if (jobs.length === 0) {
    const linkRegex = /href="(?:https:\/\/www\.workana\.com)?\/job\/([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((m = linkRegex.exec(html)) !== null) {
      const slug = m[1];
      const title = stripTags(m[2]);
      if (!slug || !title || title.length < 6 || seenInPage.has(slug)) continue;
      seenInPage.add(slug);
      jobs.push({
        id: slug,
        title,
        url: `https://www.workana.com/job/${slug}`,
        budget: '',
        category: 'IT & Programming',
        publishedAt: 'Just now',
        skills: [],
        description: '',
        clientName: '',
        clientCountry: '',
        clientHistory: '',
      });
    }
  }

  return jobs;
}

function matchesKeywords(job, keywordsStr) {
  const raw = typeof keywordsStr === 'string' ? keywordsStr.trim() : '';
  if (!raw) return true;
  const keywords = raw
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  if (keywords.length === 0) return true;

  const haystack = [
    job.title,
    job.description,
    ...(Array.isArray(job.skills) ? job.skills : []),
  ]
    .join(' ')
    .toLowerCase();

  return keywords.some((kw) => {
    if (kw.length <= 2) {
      // Whole-word match for short tokens like "it" or "ai"
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(haystack);
    }
    return haystack.includes(kw);
  });
}

async function sendEmailAlert(config, job) {
  if (!config.apiEndpoint || !config.apiKey) {
    return { skipped: true, reason: 'API key not configured' };
  }

  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
        },
        body: JSON.stringify({
          ...job,
          to: config.recipientEmail || 'ivdamir65@gmail.com',
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Email API ${response.status}: ${text.slice(0, 120)}`);
      }
      return { sent: true };
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
  }
  throw lastError;
}

function notifyDesktop(job) {
  const notifId = `job:${job.url}`;
  chrome.notifications.create(notifId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon.png'),
    title: `New Workana Job${job.budget ? ` (${job.budget})` : ''}`,
    message: `${job.title}${job.clientName ? ` — ${job.clientName}` : ''}`,
    priority: 2,
  });
}

function notifyClientMessage(msg) {
  const notifId = `msg:${msg.url}`;
  chrome.notifications.create(notifId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon.png'),
    title: `💬 Workana Message${msg.clientName ? ` from ${msg.clientName}` : ''}`,
    message: msg.description || msg.title,
    priority: 2,
  });
}

async function checkForNewMessages(config) {
  if (!config.checkMessages) return { skipped: true };

  try {
    const response = await fetch('https://www.workana.com/roaster/search/?page=1', {
      method: 'GET',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
      },
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) return { error: `HTTP ${response.status}` };
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return { skipped: true };

    const projects = await response.json();
    if (!Array.isArray(projects)) return { skipped: true };

    const stored = await chrome.storage.local.get(['seenMessageKeys', 'messagesInitialized']);
    const seenKeys = Array.isArray(stored.seenMessageKeys) ? stored.seenMessageKeys : [];
    const seenSet = new Set(seenKeys);

    const unreadClientMessages = [];
    for (const project of projects) {
      const threads = Array.isArray(project?.threads) ? project.threads : [];
      for (const t of threads) {
        const hasUnread = Boolean(t?.has_unread) || Number(t?.unreadMessages || 0) > 0;
        const fromClient = t?.messagePreviewIsMine === false;
        if (!hasUnread || !fromClient) continue;

        const key = `${t.id}:${t.last_post_created || t.unreadMessages}`;
        const rawPath = t.roasterUrl || t.url || `/inbox/${project.slug}`;
        const url = rawPath.startsWith('http') ? rawPath : `https://www.workana.com${rawPath}`;
        const clientName =
          decodeHtmlEntities(t.other_party?.name || '') ||
          decodeHtmlEntities(String(t.name || '').split(' - ').pop() || '');

        unreadClientMessages.push({
          key,
          alertType: 'message',
          title: decodeHtmlEntities(project.name || 'Workana Project'),
          url,
          clientName,
          description: stripTags(t.messagePreview || 'You have a new unread message on Workana.').slice(0, 500),
          publishedAt: 'Just now',
        });
      }
    }

    // Seed existing unread messages on first run so we don't spam old ones.
    if (!stored.messagesInitialized) {
      const initialKeys = unreadClientMessages.map((m) => m.key).slice(0, 200);
      await chrome.storage.local.set({
        messagesInitialized: true,
        seenMessageKeys: initialKeys,
      });
      return { initialized: true, unreadCount: unreadClientMessages.length };
    }

    const brandNew = unreadClientMessages.filter((m) => !seenSet.has(m.key));
    let emailsSent = 0;
    for (const msg of brandNew) {
      notifyClientMessage(msg);
      try {
        const res = await sendEmailAlert(config, msg);
        if (res.sent) emailsSent += 1;
      } catch (err) {
        console.warn('Failed to send client message email:', err.message);
      }
      seenKeys.unshift(msg.key);
    }

    if (brandNew.length > 0) {
      await chrome.storage.local.set({
        seenMessageKeys: Array.from(new Set(seenKeys)).slice(0, 200),
      });
    }

    return { newMessages: brandNew.length, emailsSent };
  } catch (err) {
    console.warn('Message check failed:', err.message);
    return { error: err.message };
  }
}

async function checkForNewJobs({ manual = false } = {}) {
  const config = await getConfig();
  if (!config.enabled && !manual) return { skipped: true };

  // Gentle random jitter (0-12s) on scheduled polls so traffic stays natural.
  if (!manual) {
    const jitterMs = Math.floor(Math.random() * 12000);
    await new Promise((resolve) => setTimeout(resolve, jitterMs));
  }

  try {
    const response = await fetch(config.jobsUrl, {
      method: 'GET',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/html;q=0.9',
      },
      credentials: 'include',
      cache: 'no-store',
    });

    if ([403, 429, 503].includes(response.status)) {
      const pausedConfig = { ...config, enabled: false };
      await chrome.storage.local.set({ config: pausedConfig });
      await scheduleAlarm(pausedConfig);
      await setStatus({
        state: 'paused',
        message: `Auto-paused: Workana returned HTTP ${response.status}. Open Workana manually, then re-enable.`,
      });
      chrome.notifications.create('workana-paused', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon.png'),
        title: 'Workana Job Alerts Paused',
        message: `Received HTTP ${response.status}. Monitoring paused automatically to protect your account.`,
        priority: 2,
      });
      return { paused: true, status: response.status };
    }

    const contentType = response.headers.get('content-type') || '';
    let jobs = [];
    if (contentType.includes('application/json')) {
      const data = await response.json();
      jobs = parseWorkanaJson(data);
    } else {
      const html = await response.text();
      if (/cf-turnstile|verify you are human|just a moment/i.test(html)) {
        const pausedConfig = { ...config, enabled: false };
        await chrome.storage.local.set({ config: pausedConfig });
        await scheduleAlarm(pausedConfig);
        await setStatus({
          state: 'paused',
          message: 'Auto-paused: Cloudflare verification detected. Open Workana in a tab, then re-enable.',
        });
        return { paused: true, reason: 'cloudflare' };
      }
      jobs = extractJobsFromHtml(html);
    }
    const stored = await chrome.storage.local.get(['seenIds', 'recentJobs', 'initialized']);
    const seenIds = Array.isArray(stored.seenIds) ? stored.seenIds : [];
    const seenSet = new Set(seenIds);

    // Seed existing jobs on first run so we don't spam alerts for older posts.
    if (!stored.initialized) {
      const initialIds = jobs.map((j) => j.id).slice(0, MAX_SEEN_IDS);
      const recentFiltered = sortByPriority(
        jobs.filter(
          (j) =>
            passesAgeFilter(j, config.maxAgeMinutes) &&
            passesBidFilter(j, config.maxBids) &&
            matchesKeywords(j, config.keywords),
        ),
      ).slice(0, MAX_RECENT_JOBS);
      await chrome.storage.local.set({
        initialized: true,
        seenIds: initialIds,
        recentJobs: recentFiltered,
      });
      await setStatus({
        state: 'ok',
        message: `Initialized with ${jobs.length} jobs (${recentFiltered.length} within ${config.maxAgeMinutes} min). Watching for new posts.`,
      });
      return { initialized: true, count: jobs.length };
    }

    const newJobs = jobs.filter((j) => !seenSet.has(j.id));
    const matchingNewJobs = sortByPriority(
      newJobs.filter(
        (j) =>
          passesAgeFilter(j, config.maxAgeMinutes) &&
          passesBidFilter(j, config.maxBids) &&
          matchesKeywords(j, config.keywords),
      ),
    );
    let emailsSent = 0;
    let emailErrors = 0;

    for (const job of newJobs) {
      seenIds.unshift(job.id);
    }

    for (const job of matchingNewJobs) {
      notifyDesktop(job);
      try {
        const res = await sendEmailAlert(config, job);
        if (res.sent) emailsSent += 1;
      } catch (err) {
        emailErrors += 1;
        console.warn('Failed to send email alert:', err.message);
      }
    }

    const updatedSeen = Array.from(new Set(seenIds)).slice(0, MAX_SEEN_IDS);
    const liveMatching = sortByPriority(
      jobs.filter(
        (j) =>
          passesAgeFilter(j, config.maxAgeMinutes) &&
          passesBidFilter(j, config.maxBids) &&
          matchesKeywords(j, config.keywords),
      ),
    ).slice(0, MAX_RECENT_JOBS);

    await chrome.storage.local.set({
      seenIds: updatedSeen,
      recentJobs: liveMatching,
    });

    const msgResult = await checkForNewMessages(config);
    const msgNote = msgResult?.newMessages ? ` · ${msgResult.newMessages} new client msg(s)!` : '';

    await setStatus({
      state: 'ok',
      message: (matchingNewJobs.length > 0
        ? `Found ${matchingNewJobs.length} matching new job(s) (${emailsSent} email(s) sent${emailErrors ? `, ${emailErrors} failed` : ''}).`
        : `Checked ${jobs.length} jobs (all languages/countries) — no new matches yet.`) + msgNote,
    });

    return { checked: jobs.length, newCount: matchingNewJobs.length, emailsSent, emailErrors };
  } catch (err) {
    await setStatus({
      state: 'error',
      message: `Check failed: ${err.message}`,
    });
    return { error: err.message };
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const config = await getConfig();
  await chrome.storage.local.set({ config });
  await scheduleAlarm(config);
});

chrome.runtime.onStartup.addListener(async () => {
  const config = await getConfig();
  await scheduleAlarm(config);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkForNewJobs({ manual: false });
  }
});

chrome.notifications.onClicked.addListener((notifId) => {
  if (notifId.startsWith('job:') || notifId.startsWith('msg:')) {
    const url = notifId.slice(4);
    chrome.tabs.create({ url });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SAVE_CONFIG') {
    (async () => {
      const nextConfig = { ...DEFAULT_CONFIG, ...(message.config || {}) };
      await chrome.storage.local.set({ config: nextConfig });
      await scheduleAlarm(nextConfig);
      sendResponse({ ok: true, config: nextConfig });
    })();
    return true;
  }

  if (message?.type === 'CHECK_NOW') {
    checkForNewJobs({ manual: true }).then((result) => sendResponse(result));
    return true;
  }

  if (message?.type === 'SEND_TEST_EMAIL') {
    (async () => {
      try {
        const config = await getConfig();
        await sendEmailAlert(config, {
          title: 'Test Alert — Full-Stack Next.js & Node.js Project',
          url: 'https://www.workana.com/jobs?category=it-programming',
          budget: 'USD 500 - 1,000',
          category: 'IT & Programming',
          publishedAt: 'Just now',
          skills: ['Next.js', 'React', 'Node.js', 'Python', 'GraphQL'],
          description: 'This is a test email from your Workana Job Alerts Chrome extension.',
          clientName: 'Test Client',
          clientCountry: 'United States',
          clientHistory: 'Verified payment method · 5 projects paid',
        });
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
});
