## Why

Some websites make platform decisions from request headers. This extension should provide a narrow, predictable way to present a selected operating system in those headers without becoming a broad fingerprint-spoofing tool.

## What Changes

- Add a Manifest V3 Chrome extension that rewrites OS-related request headers.
- Allow the target operating system to be configured, with Windows selected by default.
- Preserve the running Chrome version when constructing the replacement `User-Agent` value.
- Set `Sec-CH-UA-Platform` consistently with the selected target operating system.
- Keep the first version focused on request headers only; page JavaScript surfaces remain unchanged.

## Capabilities

### New Capabilities
- `os-header-switching`: Defines configurable OS selection and request-header rewriting for `User-Agent` and `Sec-CH-UA-Platform`.

### Modified Capabilities

None.

## Impact

- Adds extension manifest, service worker logic, and a minimal OS selection UI.
- Uses Chrome extension APIs for storage and declarative request-header modification.
- Requires permissions for dynamic header modification and storage.
- Does not alter `navigator.userAgent`, `navigator.platform`, `navigator.userAgentData`, high-entropy Client Hints, or worker JavaScript surfaces.
