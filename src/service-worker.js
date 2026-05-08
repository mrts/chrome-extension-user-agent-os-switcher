import {
  DEFAULT_TARGET_OS,
  HEADER_RULE_ID,
  PAGE_RULE_ID,
  TARGET_OS_STORAGE_KEY,
  buildHeaderRules,
  normalizeTargetOS
} from "./os.js";

const CONTENT_SCRIPT_ID = "os-header-switcher-main";
const CONTENT_SCRIPT = {
  id: CONTENT_SCRIPT_ID,
  js: ["src/inject/main.js"],
  matches: ["http://*/*", "https://*/*"],
  allFrames: true,
  matchOriginAsFallback: true,
  runAt: "document_start",
  world: "MAIN"
};

let pageScriptRegistrationPromise;

async function getStoredTargetOS() {
  const result = await chrome.storage.local.get(TARGET_OS_STORAGE_KEY);
  const storedTargetOS = result[TARGET_OS_STORAGE_KEY];
  const targetOS = normalizeTargetOS(storedTargetOS);

  if (storedTargetOS !== targetOS) {
    await chrome.storage.local.set({ [TARGET_OS_STORAGE_KEY]: targetOS });
  }

  return targetOS;
}

async function syncHeaderRule() {
  const targetOS = await getStoredTargetOS();
  const sourceUserAgent = globalThis.navigator?.userAgent || "";
  const sourceUserAgentData = await getSourceUserAgentData();
  const rules = buildHeaderRules(targetOS, sourceUserAgent, sourceUserAgentData);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [HEADER_RULE_ID, PAGE_RULE_ID],
    addRules: rules
  });
  await registerPageScript();

  return { targetOS };
}

async function getSourceUserAgentData() {
  const uaData = globalThis.navigator?.userAgentData;

  if (!uaData) {
    return {};
  }

  const hints = [
    "architecture",
    "bitness",
    "fullVersionList",
    "model",
    "platform",
    "platformVersion",
    "uaFullVersion",
    "wow64"
  ];
  const highEntropyValues = await uaData.getHighEntropyValues(hints).catch(() => ({}));

  return {
    brands: uaData.brands || [],
    mobile: uaData.mobile === true,
    highEntropyValues
  };
}

async function registerPageScript() {
  if (!pageScriptRegistrationPromise) {
    pageScriptRegistrationPromise = ensurePageScriptRegistered()
      .finally(() => {
        pageScriptRegistrationPromise = undefined;
      });
  }

  return pageScriptRegistrationPromise;
}

async function ensurePageScriptRegistered() {
  const registeredScripts = await chrome.scripting.getRegisteredContentScripts({
    ids: [CONTENT_SCRIPT_ID]
  });

  if (registeredScripts.length > 0) {
    return;
  }

  await chrome.scripting.registerContentScripts([CONTENT_SCRIPT]).catch((error) => {
    if (error.message?.includes(`Duplicate script ID '${CONTENT_SCRIPT_ID}'`)) {
      return;
    }

    throw error;
  });
}

function logSyncError(error) {
  console.error("OS_HEADER_SWITCHER_SYNC_FAILED", error);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(TARGET_OS_STORAGE_KEY).then((result) => {
    if (result[TARGET_OS_STORAGE_KEY] === undefined) {
      return chrome.storage.local.set({ [TARGET_OS_STORAGE_KEY]: DEFAULT_TARGET_OS });
    }

    return undefined;
  }).then(syncHeaderRule).catch(logSyncError);
});

chrome.runtime.onStartup.addListener(() => {
  syncHeaderRule().catch(logSyncError);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[TARGET_OS_STORAGE_KEY]) {
    syncHeaderRule().catch(logSyncError);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "sync-header-rule") {
    return false;
  }

  syncHeaderRule()
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

syncHeaderRule().catch(logSyncError);
