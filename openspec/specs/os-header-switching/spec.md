# os-header-switching Specification

## Purpose
Defines configurable desktop OS selection for latest Chrome-style request headers and page navigator user-agent surfaces while preserving browser version values.

## Requirements
### Requirement: Default Target OS
The extension SHALL use Windows as the target operating system when no target OS has been configured.

#### Scenario: First install uses Windows
- **WHEN** the extension initializes without an existing target OS setting
- **THEN** the active target OS is Windows

### Requirement: Configurable Desktop Target OS
The extension SHALL allow the user to select one target OS from Windows, macOS, and Linux, and MUST persist that selection across browser restarts.

#### Scenario: User selects macOS
- **WHEN** the user changes the target OS to macOS
- **THEN** the extension stores macOS as the active target OS

#### Scenario: Stored target OS is restored
- **WHEN** the browser restarts after the user selected Linux
- **THEN** the extension uses Linux as the active target OS

### Requirement: User-Agent Header Rewriting
The extension SHALL set the outgoing `User-Agent` request header for HTTP and HTTPS requests to a desktop Chrome user agent value matching the active target OS, and MUST preserve the running Chrome version in that value.

#### Scenario: Windows header is applied by default
- **WHEN** an HTTP or HTTPS request is made before the user changes the default target OS
- **THEN** the request `User-Agent` header contains `Windows NT 10.0; Win64; x64`
- **AND** the request `User-Agent` header contains the running Chrome version

#### Scenario: macOS header is applied
- **WHEN** an HTTP or HTTPS request is made while the active target OS is macOS
- **THEN** the request `User-Agent` header contains `Macintosh; Intel Mac OS X 10_15_7`
- **AND** the request `User-Agent` header contains the running Chrome version

#### Scenario: Linux header is applied
- **WHEN** an HTTP or HTTPS request is made while the active target OS is Linux
- **THEN** the request `User-Agent` header contains `X11; Linux x86_64`
- **AND** the request `User-Agent` header contains the running Chrome version

### Requirement: Sec-CH-UA-Platform Header Rewriting
The extension SHALL set the outgoing `Sec-CH-UA-Platform` request header for HTTP and HTTPS requests to the structured header string matching the active target OS.

#### Scenario: Windows platform hint is applied
- **WHEN** an HTTP or HTTPS request is made while the active target OS is Windows
- **THEN** the request `Sec-CH-UA-Platform` header is `"Windows"`

#### Scenario: macOS platform hint is applied
- **WHEN** an HTTP or HTTPS request is made while the active target OS is macOS
- **THEN** the request `Sec-CH-UA-Platform` header is `"macOS"`

#### Scenario: Linux platform hint is applied
- **WHEN** an HTTP or HTTPS request is made while the active target OS is Linux
- **THEN** the request `Sec-CH-UA-Platform` header is `"Linux"`

### Requirement: User-Agent Client Hint OS Version Rewriting
The extension SHALL set OS-related User-Agent Client Hint values for latest Chrome while preserving browser brand and version values.

#### Scenario: Windows 11 platform version is applied
- **WHEN** an HTTP or HTTPS request is made while the active target OS is Windows
- **THEN** the request `Sec-CH-UA-Platform-Version` header is `"13.0.0"`
- **AND** browser version headers remain based on the running Chrome version

#### Scenario: macOS platform version is applied
- **WHEN** an HTTP or HTTPS request is made while the active target OS is macOS
- **THEN** the request `Sec-CH-UA-Platform-Version` header is `"10.15.7"`
- **AND** browser version headers remain based on the running Chrome version

#### Scenario: Linux platform version is applied
- **WHEN** an HTTP or HTTPS request is made while the active target OS is Linux
- **THEN** the request `Sec-CH-UA-Platform-Version` header is `""`
- **AND** browser version headers remain based on the running Chrome version

### Requirement: Page JavaScript OS Rewriting
The extension SHALL update page JavaScript user-agent OS surfaces for normal HTTP and HTTPS documents and frames.

#### Scenario: Windows page surfaces are applied
- **WHEN** a page reads `navigator.userAgent`, `navigator.appVersion`, `navigator.platform`, or `navigator.userAgentData` while the active target OS is Windows
- **THEN** those values report Windows OS data
- **AND** `navigator.userAgentData.getHighEntropyValues()` reports Windows platform data with Windows 11 platform version

#### Scenario: Browser version values are preserved
- **WHEN** a page reads browser brand or version values from `navigator.userAgent` or `navigator.userAgentData`
- **THEN** those values remain based on the running Chrome version

### Requirement: Header Rule Synchronization
The extension SHALL synchronize request-header modification rules, page-data response header rules, and page injection scripts after service worker startup, installation, browser startup, and target OS changes.

#### Scenario: Target OS change updates rules
- **WHEN** the user changes the target OS from Windows to Linux
- **THEN** subsequent HTTP and HTTPS requests and normal page JavaScript surfaces use Linux OS values

### Requirement: Limited Spoofing Scope
The extension SHALL only provide latest Chrome-style desktop OS spoofing and SHALL NOT provide general browser, version, device, worker, or per-site spoofing.

#### Scenario: Browser version remains out of scope
- **WHEN** a request or page reports browser brand and version values
- **THEN** this capability does not require changing those values away from the running Chrome version

#### Scenario: Workers remain out of scope
- **WHEN** a page worker reads worker navigator values
- **THEN** this capability does not require those worker values to match the selected target OS
