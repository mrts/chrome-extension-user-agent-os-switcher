# OS Header Switcher

OS Header Switcher is a minimal Chrome/Chromium extension that changes the operating system reported in outgoing request headers.

It modifies only:

- `User-Agent`
- `Sec-CH-UA-Platform`

Windows is the default target OS. macOS and Linux can be selected from the extension popup. The extension preserves the running Chrome version when building the replacement `User-Agent`.

## Functional Overview

The extension is intended for simple server-side OS header testing. It does not try to be a full fingerprint spoofing tool.

Supported target OS values:

| Target | `User-Agent` OS token | `Sec-CH-UA-Platform` |
|---|---|---|
| Windows | `Windows NT 10.0; Win64; x64` | `"Windows"` |
| macOS | `Macintosh; Intel Mac OS X 10_15_7` | `"macOS"` |
| Linux | `X11; Linux x86_64` | `"Linux"` |

When the selected target is Windows, a request header will look like:

```text
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/<current-version> Safari/537.36
Sec-CH-UA-Platform: "Windows"
```

## Installation

No build step is required.

1. Open `chrome://extensions` in Chrome or Chromium.
2. Enable Developer mode.
3. Select Load unpacked.
4. Choose this repository directory.

The extension needs these permissions:

- `declarativeNetRequest`: updates request headers through a Manifest V3 dynamic rule.
- `storage`: persists the selected target OS.
- `http://*/*` and `https://*/*` host access: applies header changes broadly to normal web requests.

## Usage

1. Click the OS Header Switcher toolbar icon.
2. Select Windows, macOS, or Linux.
3. Refresh existing pages or open a new page so subsequent requests use the new headers.

The selected target OS is stored locally and restored after browser restart or extension reload.

To verify manually, inspect outgoing request headers in DevTools or use a local echo endpoint.

## Scope And Limitations

This extension is intentionally header-only. It does not modify page JavaScript APIs or high-entropy User-Agent Client Hints.

Not modified:

- `navigator.userAgent`
- `navigator.platform`
- `navigator.userAgentData`
- `Sec-CH-UA-Platform-Version`
- `Sec-CH-UA-Arch`
- `Sec-CH-UA-Bitness`

Sites that inspect those surfaces can still see values that do not match the selected request-header OS.

## Technical Overview

The extension is a plain Manifest V3 project with no bundler and no runtime dependencies.

Key files:

- `manifest.json`: declares the MV3 service worker, popup, storage permission, DNR permission, and HTTP/HTTPS host permissions.
- `src/os.js`: shared target OS metadata, Chrome version extraction, canonical UA generation, and DNR rule construction.
- `src/service-worker.js`: initializes the default target OS, listens for startup/install/storage changes, and syncs the dynamic DNR rule.
- `popup/popup.html`, `popup/popup.css`, `popup/popup.js`: minimal UI for selecting the target OS.
- `tests/os.test.mjs`: deterministic unit checks for header generation and manifest shape.
- `tests/browser-smoke.mjs`: Chromium smoke test that loads the unpacked extension and verifies headers against a local echo server.

The service worker maintains one dynamic DNR rule with id `1`. On install, startup, popup changes, or explicit sync messages, it:

1. Reads `targetOS` from `chrome.storage.local`.
2. Falls back to Windows if the value is missing or invalid.
3. Extracts the running `Chrome/<version>` or `HeadlessChrome/<version>` from the browser user agent.
4. Builds a canonical desktop Chrome `User-Agent`.
5. Sets both `User-Agent` and `Sec-CH-UA-Platform` on HTTP and HTTPS requests.

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
