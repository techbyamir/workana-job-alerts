# Workana IT & Programming Job Alerts (Chrome Extension)

A lightweight Manifest V3 Chrome extension that monitors **all Workana IT & Programming jobs** (Node.js, Python, PHP, Next.js, React, Android, React Native, APIs, GraphQL, JavaScript, web development, etc.) **only while Chrome is open**, and sends instant desktop notifications + professional email alerts via your `amirence.com` Express server.

## Safety Features
- **Browser-only:** Uses `chrome.alarms` and runs only while Chrome is open.
- **Gentle polling:** Defaults to every **3 minutes** (minimum 2 minutes) with random jitter.
- **Read-only monitoring:** Never auto-bids, auto-clicks, or auto-messages.
- **Auto-pause protection:** Automatically pauses and notifies you if Workana returns `403`, `429`, `503`, or a Cloudflare challenge.

## Setup
1. Add `JOB_ALERT_API_KEY` (a strong random secret) and optionally `JOB_ALERT_TO_EMAIL` (`ivdamir65@gmail.com`) to your `amirence-site` GitHub Actions secrets and deploy.
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select this folder.
5. Click the extension icon, paste your `JOB_ALERT_API_KEY`, verify your recipient email, click **Save**, and click **Test Email** to confirm delivery.
