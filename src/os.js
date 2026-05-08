export const DEFAULT_TARGET_OS = "windows";
export const TARGET_OS_STORAGE_KEY = "targetOS";
export const HEADER_RULE_ID = 1;
export const PAGE_RULE_ID = 2;
export const SERVER_TIMING_NAME = "oshs-json-data";

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
    platform: "Win32",
    uaPlatform: "Windows",
    platformVersion: "13.0.0",
    architecture: "x86",
    bitness: "64"
  }),
  macos: Object.freeze({
    label: "macOS",
    userAgentOS: "Macintosh; Intel Mac OS X 10_15_7",
    platform: "MacIntel",
    uaPlatform: "macOS",
    platformVersion: "10.15.7",
    architecture: "x86",
    bitness: "64"
  }),
  linux: Object.freeze({
    label: "Linux",
    userAgentOS: "X11; Linux x86_64",
    platform: "Linux x86_64",
    uaPlatform: "Linux",
    platformVersion: "",
    architecture: "x86",
    bitness: "64"
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

export function buildCanonicalChromeUserAgent(targetOS, chromeVersion) {
  const os = TARGET_OS_OPTIONS[normalizeTargetOS(targetOS)];

  return `Mozilla/5.0 (${os.userAgentOS}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
}

export function replaceUserAgentOS(targetOS, sourceUserAgent) {
  const normalizedTargetOS = normalizeTargetOS(targetOS);
  const os = TARGET_OS_OPTIONS[normalizedTargetOS];

  if (/^Mozilla\/5\.0 \([^)]*\)/.test(sourceUserAgent || "")) {
    return sourceUserAgent.replace(/^Mozilla\/5\.0 \([^)]*\)/, `Mozilla/5.0 (${os.userAgentOS})`);
  }

  return buildCanonicalChromeUserAgent(normalizedTargetOS, getChromeVersion(sourceUserAgent));
}

export const buildChromeUserAgent = buildCanonicalChromeUserAgent;

export function buildSpoofProfile(targetOS, sourceUserAgent, sourceUserAgentData = {}) {
  const normalizedTargetOS = normalizeTargetOS(targetOS);
  const os = TARGET_OS_OPTIONS[normalizedTargetOS];
  const userAgent = replaceUserAgentOS(normalizedTargetOS, sourceUserAgent);
  const sourceHighEntropyValues = sourceUserAgentData.highEntropyValues || {};

  const highEntropyValues = {
    ...sourceHighEntropyValues,
    architecture: os.architecture,
    bitness: os.bitness,
    model: "",
    platform: os.uaPlatform,
    platformVersion: os.platformVersion,
    wow64: false
  };

  return {
    targetOS: normalizedTargetOS,
    userAgent,
    appVersion: userAgent.replace(/^Mozilla\//, ""),
    platform: os.platform,
    userAgentData: {
      brands: sourceUserAgentData.brands || [],
      mobile: false,
      platform: os.uaPlatform,
      highEntropyValues
    }
  };
}

export function buildHeaderRules(targetOS, sourceUserAgent, sourceUserAgentData = {}) {
  const profile = buildSpoofProfile(targetOS, sourceUserAgent, sourceUserAgentData);
  const timingValue = `${SERVER_TIMING_NAME};dur=0;desc="${encodeURIComponent(JSON.stringify(profile))}"`;

  return [{
    id: HEADER_RULE_ID,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [
        {
          header: "User-Agent",
          operation: "set",
          value: profile.userAgent
        },
        {
          header: "Sec-CH-UA-Platform",
          operation: "set",
          value: `"${profile.userAgentData.platform}"`
        },
        {
          header: "Sec-CH-UA-Platform-Version",
          operation: "set",
          value: `"${profile.userAgentData.highEntropyValues.platformVersion}"`
        },
        {
          header: "Sec-CH-UA-Mobile",
          operation: "set",
          value: "?0"
        }
      ]
    },
    condition: {
      regexFilter: "^https?://",
      resourceTypes: RESOURCE_TYPES
    }
  }, {
    id: PAGE_RULE_ID,
    priority: 1,
    action: {
      type: "modifyHeaders",
      responseHeaders: [
        {
          header: "Server-Timing",
          operation: "set",
          value: timingValue
        }
      ]
    },
    condition: {
      regexFilter: "^https?://",
      resourceTypes: ["main_frame", "sub_frame"]
    }
  }];
}

export function buildHeaderRule(targetOS, sourceUserAgent, ruleId = HEADER_RULE_ID) {
  const [rule] = buildHeaderRules(targetOS, sourceUserAgent);

  return {
    ...rule,
    id: ruleId
  };
}

export function getRuleIds() {
  return {
    HEADER_RULE_ID,
    PAGE_RULE_ID
  };
}
