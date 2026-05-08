# User agent OS switcher

User agent OS switcher is a minimal Chrome/Chromium extension that changes the operating system reported by the latest Chrome-style user-agent surfaces.

It modifies OS-related values in:

- `User-Agent`
- `Sec-CH-UA-Platform`
- `Sec-CH-UA-Platform-Version`
- `navigator.userAgent`
- `navigator.appVersion`
- `navigator.platform`
- `navigator.userAgentData`

Windows is the default target OS. macOS and Linux can be selected from the extension popup. Browser version values are preserved from the running Chrome/Chromium instance.

## Functional Overview

The extension is intended for simple OS-compatibility testing in current Chrome/Chromium. It does not provide browser/version rotation and does not try to be a general fingerprint-spoofing tool.

Supported target OS values:

| Target | `User-Agent` OS token | `Sec-CH-UA-Platform` | `navigator.platform` | Platform version |
|---|---|---|---|---|
| Windows 11 | `Windows NT 10.0; Win64; x64` | `"Windows"` | `Win32` | `13.0.0` |
| macOS | `Macintosh; Intel Mac OS X 10_15_7` | `"macOS"` | `MacIntel` | `10.15.7` |
| Linux | `X11; Linux x86_64` | `"Linux"` | `Linux x86_64` | empty |

Chrome's legacy `User-Agent` string does not distinguish Windows 10 from Windows 11; both use `Windows NT 10.0`. Windows 11 is represented through the User-Agent Client Hints platform version.

When the selected target is Windows, request headers look like:

```text
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/<current-version> Safari/537.36
Sec-CH-UA-Platform: "Windows"
Sec-CH-UA-Platform-Version: "13.0.0"
```

## Installation

No build step is required.

1. Open `chrome://extensions` in Chrome or Chromium.
2. Enable Developer mode.
3. Select Load unpacked.
4. Choose this repository directory.

The extension needs these permissions:

- `declarativeNetRequest`: updates request headers through a Manifest V3 dynamic rule.
- `declarativeNetRequestWithHostAccess`: allows the dynamic rule to modify response headers for sites covered by host permissions.
- `scripting`: registers an early page script that updates Chrome's navigator user-agent surfaces.
- `storage`: persists the selected target OS.
- `http://*/*` and `https://*/*` host access: applies header changes broadly to normal web requests.

## Usage

1. Click the User agent OS switcher toolbar icon.
2. Select Windows, macOS, or Linux.
3. Refresh existing pages or open a new page so subsequent requests and page JavaScript see the new OS values.

The selected target OS is stored locally and restored after browser restart or extension reload.

To verify manually, inspect outgoing request headers in DevTools and check page JavaScript values such as `navigator.platform` or `navigator.userAgentData.platform`.

## Scope And Limitations

This extension only changes OS-related values. It keeps the running Chrome/Chromium browser version and brand values.

Not modified:

- Browser brand/version fields such as `Chrome/<version>`, `Sec-CH-UA`, `fullVersionList`, and `uaFullVersion`
- Worker navigator surfaces
- Non-Chrome browser emulation
- Per-site profiles
- Mobile OS/device model spoofing

The page override is implemented with early MAIN-world content scripts. It covers normal documents and frames, but it is still not a complete anti-fingerprinting system.

## Technical Overview

The extension is a plain Manifest V3 project with no bundler and no runtime dependencies.

Key files:

- `manifest.json`: declares the MV3 service worker, popup, storage/DNR/scripting permissions, and HTTP/HTTPS host permissions.
- `src/os.js`: shared target OS metadata, Chrome version preservation, OS replacement, spoof profile construction, and DNR rule construction.
- `src/service-worker.js`: initializes the default target OS, listens for startup/install/storage changes, syncs dynamic DNR rules, and registers the page script.
- `src/inject/main.js`: MAIN-world page script that reads spoof data from a DNR-injected `Server-Timing` response header and overrides navigator getters.
- `popup/popup.html`, `popup/popup.css`, `popup/popup.js`: minimal UI for selecting the target OS.
- `tests/os.test.mjs`: deterministic unit checks for header generation and manifest shape.
- `tests/browser-smoke.mjs`: Chromium smoke test that loads the unpacked extension and verifies headers against a local echo server.

The service worker maintains two dynamic DNR rules:

- Rule `1`: sets OS-related request headers.
- Rule `2`: injects a `Server-Timing` response header for documents and frames so the page script can receive the same OS profile.

On service worker startup, install, browser startup, popup changes, or explicit sync messages, it:

1. Reads `targetOS` from `chrome.storage.local`.
2. Falls back to Windows if the value is missing or invalid.
3. Reads current Chrome User-Agent Client Hint data where available.
4. Replaces only the OS portion of the `User-Agent`.
5. Preserves browser version and brand values.
6. Sets OS-related request headers.
7. Registers the MAIN-world script that updates page JavaScript OS surfaces.

## Development And Verification

Run deterministic checks:

```sh
npm test
```

Run the browser smoke test with Chromium or Chrome for Testing:

```sh
CHROME_BIN=/snap/bin/chromium npm run test:browser
```

Branded Google Chrome 137 and later disables command-line extension loading, so `npm run test:browser` skips by default when only that browser is available. Use Chromium or Chrome for Testing for automated extension loading.
