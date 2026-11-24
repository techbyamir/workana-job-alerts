# Workana IT & Programming Job Alerts (Chrome Extension)

A lightweight Manifest V3 Chrome extension that monitors **all Workana IT & Programming jobs** across **every language and country**, prioritizes the **newest, lowest-competition opportunities**, and sends instant desktop notifications + professional email alerts via your `amirence.com` Express server.

---

## How It Works

- **Runs only while Chrome is open:** Uses a Manifest V3 background service worker and `chrome.alarms`.
- **No Workana tab required:** You do **not** need to keep Workana open. The extension checks Workana's JSON feed (`X-Requested-With: XMLHttpRequest`) in the background using your normal Chrome session cookies, and stops automatically when you close Chrome.
- **All languages & all countries:** Default filter URL is `https://www.workana.com/jobs?category=it-programming&language=xx` (`language=xx` = all languages and countries).
- **Early & low-competition priority:**
  - Polls every **2 minutes** by default (configurable from 1 to 30 minutes) with gentle random jitter.
  - **Max Age filter (default `20` minutes):** Ignores any job posted more than 20 minutes ago — only alerts on fresh jobs posted within the last 20 minutes.
  - **Max Bids filter (default `20`, set to `0` for no limit):** Only alerts on low-competition jobs with fewer bids from freelancers.
  - Sorts matching new jobs so the newest posts (fewest minutes ago) and lowest bid counts are alerted **first**.
- **Configurable skill matching:** Matches job titles, skills, and descriptions against your target stack (PHP, MySQL, JavaScript, TypeScript, HTML, CSS, Databases, SQL, APIs, REST, GraphQL, Responsive Web Design, Android, React, React Native, Next.js, Node.js, Python, C++, Electron, Chatbots, Shopify, Web Services, System Analysis, IT, CRM, ERP, WordPress, Automation, AI, SaaS, etc.). Leave blank to receive alerts for all IT & Programming jobs.
- **Instant alerts:**
  - **Chrome Desktop Notification** (clickable directly to the Workana job page).
  - **Professional Email Alert** sent via `POST https://amirence.com/api/job-alerts` with sender **`🚨 Workana Job Alert`**, including job title, budget, client name, country, payment verification / rating / bid count, skills, project summary, and a direct Workana link.

---

## Account Safety Features

- **Read-only monitoring:** Only reads the job listing feed — never auto-bids, auto-clicks, or auto-messages.
- **Gentle polling:** Default 2-minute interval with random jitter to keep traffic natural.
- **Auto-pause protection:** Automatically pauses monitoring and notifies you if Workana returns HTTP `403`, `429`, `503`, or a Cloudflare challenge.
- **Authenticated email webhook:** Calls your `amirence.com` server using a private `x-api-key` secret (`JOB_ALERT_API_KEY`) with server-side rate limiting.

---

## Setup Guide

### 1. Configure `JOB_ALERT_API_KEY` on `amirence.com`
1. Generate a strong random secret key:
   ```bash
   openssl rand -hex 32
   ```
2. Add `JOB_ALERT_API_KEY` (and optionally `JOB_ALERT_TO_EMAIL`, default `ivdamir65@gmail.com`) in **GitHub → `amirence/amirence-site` → Settings → Secrets and variables → Actions**.
3. Run or re-run the **Deploy to VPS** workflow so the production server loads the secret.

### 2. Load the Extension in Chrome
1. Open `chrome://extensions/` in Chrome.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder (`/home/amir/DEV/workana-job-alerts`).
4. Pin the extension icon to your Chrome toolbar.

### 3. Configure & Test
1. Click the extension icon in Chrome.
2. Paste your `JOB_ALERT_API_KEY` into **Email API Key**.
3. Verify your **Alert Email**, **Interval (min)** (default `2`), **Max Bids** (default `20`), **Workana Filter URL**, and **Matching Skills / Keywords**.
4. Click **Save**, then click **Test Email** to confirm delivery to your inbox.
5. Click **Check Now** to initialize with the latest live Workana jobs and start watching for new posts.

---

## Files

- `manifest.json` — Manifest V3 configuration (`alarms`, `notifications`, `storage`, `host_permissions`).
- `background.js` — Background service worker for XHR JSON polling, keyword & low-bid filtering, priority sorting, desktop notifications, and email webhook calls.
- `popup.html` / `popup.css` / `popup.js` — Extension popup UI for settings, status, manual checks, test email, and recent jobs.
- `icon.png` — Extension and desktop notification icon.
