## 1. Extension Scaffold

- [x] 1.1 Create the Manifest V3 extension file structure.
- [x] 1.2 Add `manifest.json` with action, service worker, storage, and declarative net request permissions.
- [x] 1.3 Declare HTTP and HTTPS host access needed for broad request-header rewriting.

## 2. Header Switching Logic

- [x] 2.1 Define supported target OS values and mappings for UA OS tokens and `Sec-CH-UA-Platform` values.
- [x] 2.2 Implement Chrome version extraction from the running browser user agent.
- [x] 2.3 Build canonical desktop Chrome `User-Agent` values that preserve the extracted Chrome version.
- [x] 2.4 Implement dynamic DNR rule synchronization for `User-Agent` and `Sec-CH-UA-Platform`.
- [x] 2.5 Ensure the DNR rule explicitly matches HTTP and HTTPS main-frame and subresource requests.
- [x] 2.6 Run rule synchronization after install, browser startup, and target OS changes.

## 3. Target OS Configuration

- [x] 3.1 Initialize the stored target OS to Windows when no setting exists.
- [x] 3.2 Create a minimal popup UI for selecting Windows, macOS, or Linux.
- [x] 3.3 Persist target OS changes in extension storage.
- [x] 3.4 Refresh header rules immediately after the user changes the target OS.

## 4. Verification

- [x] 4.1 Verify default Windows headers are applied and include the running Chrome version.
- [x] 4.2 Verify macOS and Linux selections update both request headers.
- [x] 4.3 Verify the selected target OS persists across browser restart or extension reload.
- [x] 4.4 Verify page JavaScript surfaces and high-entropy Client Hints are not modified by this change.
- [x] 4.5 Document loading the unpacked extension and the header-only scope boundary.
