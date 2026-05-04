export const DEFAULT_TARGET_OS = "windows";
export const TARGET_OS_STORAGE_KEY = "targetOS";
export const HEADER_RULE_ID = 1;

export const RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "csp_report",
  "media",
  "websocket",
  "webtransport",
  "webbundle",
  "other"
];

export const TARGET_OS_OPTIONS = Object.freeze({
  windows: Object.freeze({
    label: "Windows",
    userAgentOS: "Windows NT 10.0; Win64; x64",
    platformHeaderValue: "\"Windows\""
  }),
  macos: Object.freeze({
    label: "macOS",
    userAgentOS: "Macintosh; Intel Mac OS X 10_15_7",
    platformHeaderValue: "\"macOS\""
  }),
  linux: Object.freeze({
    label: "Linux",
    userAgentOS: "X11; Linux x86_64",
    platformHeaderValue: "\"Linux\""
  })
});

export function normalizeTargetOS(value) {
  return Object.prototype.hasOwnProperty.call(TARGET_OS_OPTIONS, value) ? value : DEFAULT_TARGET_OS;
}

export function getChromeVersion(userAgent) {
  const match = /\b(?:Chrome|HeadlessChrome)\/([0-9]+(?:\.[0-9]+){0,3})\b/.exec(userAgent || "");

  if (!match) {
    throw new Error("Unable to extract Chrome version from user agent.");
  }

  return match[1];
}

export function buildChromeUserAgent(targetOS, chromeVersion) {
  const os = TARGET_OS_OPTIONS[normalizeTargetOS(targetOS)];

  return `Mozilla/5.0 (${os.userAgentOS}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
}

export function buildHeaderRule(targetOS, sourceUserAgent, ruleId = HEADER_RULE_ID) {
  const normalizedTargetOS = normalizeTargetOS(targetOS);
  const chromeVersion = getChromeVersion(sourceUserAgent);
  const os = TARGET_OS_OPTIONS[normalizedTargetOS];

  return {
    id: ruleId,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [
        {
          header: "User-Agent",
          operation: "set",
          value: buildChromeUserAgent(normalizedTargetOS, chromeVersion)
        },
        {
          header: "Sec-CH-UA-Platform",
          operation: "set",
          value: os.platformHeaderValue
        }
      ]
    },
    condition: {
      regexFilter: "^https?://",
      resourceTypes: RESOURCE_TYPES
    }
  };
}
