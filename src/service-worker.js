import {
  DEFAULT_TARGET_OS,
  HEADER_RULE_ID,
  TARGET_OS_STORAGE_KEY,
  buildHeaderRule,
  normalizeTargetOS
} from "./os.js";

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
  const rule = buildHeaderRule(targetOS, sourceUserAgent);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [HEADER_RULE_ID],
    addRules: [rule]
  });

  return { targetOS };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(TARGET_OS_STORAGE_KEY).then((result) => {
    if (result[TARGET_OS_STORAGE_KEY] === undefined) {
      return chrome.storage.local.set({ [TARGET_OS_STORAGE_KEY]: DEFAULT_TARGET_OS });
    }

    return undefined;
  }).then(syncHeaderRule);
});

chrome.runtime.onStartup.addListener(() => {
  syncHeaderRule();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[TARGET_OS_STORAGE_KEY]) {
    syncHeaderRule();
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
