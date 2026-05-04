## Context

The repository is starting from an empty extension project. The first useful slice is a focused Manifest V3 extension that changes only request headers used for OS detection: `User-Agent` and `Sec-CH-UA-Platform`.

The extension needs a small amount of state because the target OS is configurable. Windows is the default target. The running Chrome version must be preserved dynamically, so a static rule file is not enough.

## Goals / Non-Goals

**Goals:**
- Provide a configurable desktop target OS: Windows, macOS, or Linux.
- Default to Windows when no user setting exists.
- Use the installed Chrome version when generating replacement `User-Agent` values.
- Keep `Sec-CH-UA-Platform` consistent with the selected target OS.
- Apply the selected headers to normal HTTP and HTTPS requests.

**Non-Goals:**
- No JavaScript surface spoofing for `navigator.userAgent`, `navigator.platform`, or `navigator.userAgentData`.
- No high-entropy Client Hint spoofing, including `Sec-CH-UA-Platform-Version`, `Sec-CH-UA-Arch`, or `Sec-CH-UA-Bitness`.
- No Android, iOS, ChromeOS, per-site profiles, or device-model spoofing in the first release.
- No attempt to defeat fingerprinting systems beyond the two selected request headers.

## Decisions

1. Use Manifest V3 with `chrome.declarativeNetRequest` dynamic rules.

   Dynamic rules let the service worker update header values when the user changes the target OS. Static rules were rejected because they cannot preserve the current Chrome version without baking in a version string.

2. Generate canonical desktop Chrome UA strings from the current Chrome version.

   The service worker will extract `Chrome/<version>` from `navigator.userAgent` and build a replacement value using a known OS token:
   - Windows: `Windows NT 10.0; Win64; x64`
   - macOS: `Macintosh; Intel Mac OS X 10_15_7`
   - Linux: `X11; Linux x86_64`

   This is more predictable than attempting to surgically mutate every possible source UA string. It preserves the value the user explicitly cares about: the running Chrome version.

3. Set `Sec-CH-UA-Platform` as a structured header string.

   The extension will map the target OS to the quoted values Chrome sites expect:
   - Windows: `"Windows"`
   - macOS: `"macOS"`
   - Linux: `"Linux"`

4. Keep configuration minimal.

   Use `chrome.storage.local` for a single `targetOS` value. The popup UI only needs an OS selector; no profiles, rule editors, or domain scoping are part of this change.

5. Apply to HTTP and HTTPS resource types through explicit DNR conditions.

   The dynamic rule should match normal web requests, including top-level navigations and subresources. The implementation should use explicit URL/resource conditions so main-frame requests are not accidentally excluded by DNR defaults.

## Risks / Trade-offs

- Header-only spoofing can disagree with page JavaScript surfaces -> Document this boundary and keep the implementation intentionally narrow.
- Other extensions can also modify request headers -> Use explicit rule priority, but Chrome still resolves conflicts between extensions according to browser rules.
- Client Hint coverage is partial -> Only `Sec-CH-UA-Platform` is in scope; high-entropy hints remain real unless a future change expands scope.
- Canonical UA construction may not preserve every detail of the source UA -> Preserve Chrome version dynamically and keep OS tokens stable for desktop targets.
