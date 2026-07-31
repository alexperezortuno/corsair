# Corsair HTTP Interceptor

A browser extension (Chrome & Firefox) for intercepting, inspecting, and modifying HTTP responses in real time using the Chrome Debugger Protocol.

---

## Installation

### Chrome (Web Store)
> Coming soon — install from the Chrome Web Store once published.

### Firefox (Add-ons)
> Coming soon — install from Mozilla Add-ons once published.

### Development (unpacked)

**Chrome:**
```bash
pnpm dev
```
This starts a file-watching dev server and loads the extension in Chrome as an unpacked extension at `chrome://extensions` (Developer mode → Load unpacked).

**Firefox:**
```bash
pnpm dev:firefox
```

**Reload after changes:** Click "Update" on `chrome://extensions` / `about:addons`.

---

## Usage

1. **Attach to a tab** — Click **Attach** in the extension sidepanel. The extension uses `chrome.debugger` to instrument the tab. You cannot debug `chrome://`, `devtools://`, or other internal pages.
2. **Create a rule** — Expand the **New rule** panel, fill in the URL/domain pattern, match type, and response modifications.
3. **Trigger the rule** — Navigate to a URL matching your pattern. The response is intercepted and modified live.
4. **Inspect results** — The **Activity log** panel shows every matched and modified request in real time.

### Rule options

| Field | Description |
|---|---|
| **Name** | Rule label |
| **Priority** | Higher numbers match first |
| **Intercept by** | Match against URL or domain |
| **Match type** | `exact`, `contains`, `wildcard`, `regex` |
| **Pattern** | The string or regex to match |
| **Status code / text** | Override the HTTP status |
| **Response headers** | One `name: value` per line |
| **Body mode** | `none`, `static`, `text-replace`, `regex-replace`, `full-replacement` |

---

## Architecture

```
entrypoints/
  background.ts    — Service worker, debugger gateway, sidepanel opener
  content.ts       — Minimal injector (matches google.com only by default)
  sidepanel/       — Vue 3 UI (rules form, rules list, activity log)

lib/
  bootstrap/       — DI container setup
  core/            — EventBus, Logger, Container, Errors
  debugger/        — Chrome Debugger Protocol wrapper
  network/         — CDP Network/Fetch domain interception
  interceptor/     — Rule matching and request/response pipeline
  rules/           — Rule domain, storage, application service
```

### Interception flow

```
chrome.debugger + CDP Fetch domain
         │
         ▼
NetworkInterceptorService
  (receives Fetch.requestPaused events)
         │
         ▼
InterceptionService
  (applies enabled rules in priority order)
         │
         ├─ matched + no body change → Fetch.continueRequest
         ├─ matched + body changed  → Fetch.fulfillRequest (base64 body)
         └─ no match               → Fetch.continueRequest
```

Rules are stored in `chrome.storage.local` under the key `corsair.interceptionRules`.

---

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Dev server (Chrome) |
| `pnpm dev:firefox` | Dev server (Firefox) |
| `pnpm build` | Production build (Chrome) |
| `pnpm build:firefox` | Production build (Firefox) |
| `pnpm zip` | Build + package Chrome zip |
| `pnpm zip:firefox` | Build + package Firefox zip |
| `pnpm compile` | Type-check only (`vue-tsc --noEmit`) |

---

## Publishing

### Manual upload (Chrome Web Store)

```bash
pnpm store
```

This builds and zips both Chrome and Firefox packages, then opens the Chrome Web Store Developer Dashboard in your browser. Upload the zip from `.output/corsair-0.1.0-chrome.zip`.

For Firefox: go to [addons.mozilla.org/developers](https://addons.mozilla.org/developers/) and upload `.output/corsair-0.1.0-firefox.zip`.

### Automated via GitHub Actions

The `publish` workflow triggers on every GitHub release and can also be run manually from the Actions tab.

**Required GitHub Secrets:**

| Secret | Description |
|---|---|
| `CHROME_EXTENSION_ID` | Your Chrome Web Store extension ID |
| `CHROME_CLIENT_ID` | Google Cloud OAuth client ID |
| `CHROME_CLIENT_SECRET` | Google Cloud OAuth client secret |
| `CHROME_REFRESH_TOKEN` | Google Cloud OAuth refresh token |
| `FIREFOX_API_KEY` | Firefox Addons API key |
| `FIREFOX_API_SECRET` | Firefox Addons API secret |

**Getting Chrome Web Store credentials:**

1. Go to [Google Cloud Console](https://console.cloud.google.com) → create a project (or use an existing one).
2. Enable the **Chrome Web Store API** for the project.
3. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID** → Application type: "Web application". Note the **Client ID** and **Client Secret**.
4. Go to [Chrome Web Store Developer Dashboard → Settings → Access API](https://chrome.google.com/u/1/webstore/devconsole) and generate a refresh token.

**Getting Firefox Addons credentials:**

1. Sign in to [addons.mozilla.org/developers](https://addons.mozilla.org/developers/).
2. Go to **Manage API Keys** and create a new API key + secret.

**Setting GitHub variables:**

| Variable | Value |
|---|---|
| `FIREFOX_ADDON_ID` | Your Firefox add-on ID (e.g. `addons@ corsair`) — only needed if reusing an existing ID |

---

## Debugging

The extension logs all significant events to the **Activity log** panel in the sidepanel UI. For deeper diagnostics:

**Attach the extension's own background script DevTools:**
1. Go to `chrome://extensions`
2. Find **Corsair HTTP Interceptor**
3. Click **Service Worker** → **Inspect**

**Protocol-level trace:**
The `Diagnostics` button in the UI attaches and detaches the debugger, logging every step. Inspect the console in the background DevTools for CDP traffic.

---

## Requirements

- Chrome 116+ (uses `chrome.debugger` + CDP `Fetch` domain)
- Node.js 18+
- pnpm 8+
