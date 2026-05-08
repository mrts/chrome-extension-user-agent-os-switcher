import assert from "node:assert/strict";
import fs from "node:fs";

import {
  DEFAULT_TARGET_OS,
  RESOURCE_TYPES,
  TARGET_OS_OPTIONS,
  buildHeaderRules,
  buildChromeUserAgent,
  buildHeaderRule,
  buildSpoofProfile,
  getChromeVersion,
  normalizeTargetOS
} from "../src/os.js";

const sourceUserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.86 Safari/537.36";

assert.equal(DEFAULT_TARGET_OS, "windows");
assert.equal(normalizeTargetOS(undefined), "windows");
assert.equal(normalizeTargetOS("unsupported"), "windows");
assert.equal(normalizeTargetOS("macos"), "macos");

assert.equal(getChromeVersion(sourceUserAgent), "123.0.6312.86");
assert.equal(getChromeVersion("Mozilla/5.0 HeadlessChrome/123.0.6312.86 Safari/537.36"), "123.0.6312.86");
assert.throws(() => getChromeVersion("Mozilla/5.0 Safari/537.36"), /Unable to extract Chrome version/);

assert.equal(
  buildChromeUserAgent("windows", "123.0.6312.86"),
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.86 Safari/537.36"
);
assert.match(buildChromeUserAgent("macos", "123.0.6312.86"), /Macintosh; Intel Mac OS X 10_15_7/);
assert.match(buildChromeUserAgent("linux", "123.0.6312.86"), /X11; Linux x86_64/);

for (const [targetOS, option] of Object.entries(TARGET_OS_OPTIONS)) {
  const rule = buildHeaderRule(targetOS, sourceUserAgent);
  const userAgentHeader = rule.action.requestHeaders.find((header) => header.header === "User-Agent");
  const platformHeader = rule.action.requestHeaders.find((header) => header.header === "Sec-CH-UA-Platform");
  const platformVersionHeader = rule.action.requestHeaders.find((header) => header.header === "Sec-CH-UA-Platform-Version");
  const mobileHeader = rule.action.requestHeaders.find((header) => header.header === "Sec-CH-UA-Mobile");
  const profile = buildSpoofProfile(targetOS, sourceUserAgent, {
    brands: [{ brand: "Chromium", version: "123" }],
    highEntropyValues: {
      fullVersionList: [{ brand: "Chromium", version: "123.0.6312.86" }],
      uaFullVersion: "123.0.6312.86"
    }
  });
  const rules = buildHeaderRules(targetOS, sourceUserAgent);

  assert.equal(rule.id, 1);
  assert.equal(rule.action.type, "modifyHeaders");
  assert.equal(rule.condition.regexFilter, "^https?://");
  assert.deepEqual(rule.condition.resourceTypes, RESOURCE_TYPES);
  assert.equal(rule.action.requestHeaders.length, 4);
  assert.equal(userAgentHeader.operation, "set");
  assert.match(userAgentHeader.value, /Chrome\/123\.0\.6312\.86/);
  assert.match(userAgentHeader.value, new RegExp(option.userAgentOS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.deepEqual(platformHeader, {
    header: "Sec-CH-UA-Platform",
    operation: "set",
    value: `"${option.uaPlatform}"`
  });
  assert.deepEqual(platformVersionHeader, {
    header: "Sec-CH-UA-Platform-Version",
    operation: "set",
    value: `"${option.platformVersion}"`
  });
  assert.deepEqual(mobileHeader, {
    header: "Sec-CH-UA-Mobile",
    operation: "set",
    value: "?0"
  });
  assert.equal(profile.platform, option.platform);
  assert.equal(profile.userAgentData.platform, option.uaPlatform);
  assert.equal(profile.userAgentData.highEntropyValues.platformVersion, option.platformVersion);
  assert.equal(profile.userAgentData.highEntropyValues.uaFullVersion, "123.0.6312.86");
  assert.equal(rules.length, 2);
  assert.equal(rules[1].action.responseHeaders[0].header, "Server-Timing");
}

const manifest = JSON.parse(fs.readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.host_permissions, ["http://*/*", "https://*/*"]);
assert.ok(manifest.permissions.includes("declarativeNetRequest"));
assert.ok(manifest.permissions.includes("declarativeNetRequestWithHostAccess"));
assert.ok(manifest.permissions.includes("scripting"));
assert.ok(manifest.permissions.includes("storage"));
assert.equal(manifest.content_scripts, undefined);
assert.equal(manifest.background.service_worker, "src/service-worker.js");
assert.equal(manifest.background.type, "module");
