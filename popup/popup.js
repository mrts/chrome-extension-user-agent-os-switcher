import {
  DEFAULT_TARGET_OS,
  TARGET_OS_OPTIONS,
  TARGET_OS_STORAGE_KEY,
  normalizeTargetOS
} from "../src/os.js";

const targetOSSelect = document.querySelector("#target-os");
const status = document.querySelector("#status");

function setStatus(message) {
  status.textContent = message;
}

function populateOptions() {
  for (const [value, option] of Object.entries(TARGET_OS_OPTIONS)) {
    const element = document.createElement("option");
    element.value = value;
    element.textContent = option.label;
    targetOSSelect.append(element);
  }
}

async function getTargetOS() {
  const result = await chrome.storage.local.get(TARGET_OS_STORAGE_KEY);
  const targetOS = normalizeTargetOS(result[TARGET_OS_STORAGE_KEY]);

  if (result[TARGET_OS_STORAGE_KEY] !== targetOS) {
    await chrome.storage.local.set({ [TARGET_OS_STORAGE_KEY]: targetOS });
  }

  return targetOS;
}

async function syncHeaderRule() {
  const response = await chrome.runtime.sendMessage({ type: "sync-header-rule" });

  if (!response?.ok) {
    throw new Error(response?.error || "Unable to update header rule.");
  }
}

async function initializePopup() {
  populateOptions();
  targetOSSelect.value = await getTargetOS() || DEFAULT_TARGET_OS;
  setStatus("Headers active.");
}

targetOSSelect.addEventListener("change", async () => {
  const targetOS = normalizeTargetOS(targetOSSelect.value);

  targetOSSelect.disabled = true;
  setStatus("Updating...");

  try {
    await chrome.storage.local.set({ [TARGET_OS_STORAGE_KEY]: targetOS });
    await syncHeaderRule();
    targetOSSelect.value = targetOS;
    setStatus("Headers updated.");
  } catch (error) {
    setStatus(error.message);
  } finally {
    targetOSSelect.disabled = false;
    targetOSSelect.focus();
  }
});

initializePopup().catch((error) => {
  setStatus(error.message);
});
