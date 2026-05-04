# os-header-switching Specification

## Purpose
Defines configurable desktop OS selection and request-header rewriting for `User-Agent` and `Sec-CH-UA-Platform`.

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

### Requirement: Header Rule Synchronization
The extension SHALL synchronize its request-header modification rules after installation, browser startup, and target OS changes.

#### Scenario: Target OS change updates rules
- **WHEN** the user changes the target OS from Windows to Linux
- **THEN** subsequent HTTP and HTTPS requests use Linux values for both `User-Agent` and `Sec-CH-UA-Platform`

### Requirement: Header-Only Scope
The extension SHALL NOT modify page JavaScript user-agent surfaces or high-entropy User-Agent Client Hint headers as part of this capability.

#### Scenario: Page JavaScript surfaces remain out of scope
- **WHEN** a page reads `navigator.userAgent`, `navigator.platform`, or `navigator.userAgentData`
- **THEN** this capability does not require those page JavaScript values to match the selected target OS

#### Scenario: High-entropy hints remain out of scope
- **WHEN** a site requests `Sec-CH-UA-Platform-Version`, `Sec-CH-UA-Arch`, or `Sec-CH-UA-Bitness`
- **THEN** this capability does not require those headers to match the selected target OS
