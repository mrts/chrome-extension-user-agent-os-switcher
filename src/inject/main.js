(() => {
  const SERVER_TIMING_NAME = "oshs-json-data";

  function readProfile() {
    for (const entry of performance.getEntriesByType("navigation")) {
      for (const timing of entry.serverTiming || []) {
        if (timing.name === SERVER_TIMING_NAME && timing.description) {
          return JSON.parse(decodeURIComponent(timing.description));
        }
      }
    }

    return null;
  }

  function defineNavigatorGetter(name, value) {
    Object.defineProperty(Object.getPrototypeOf(navigator), name, {
      configurable: true,
      get: () => value
    });
  }

  function buildUserAgentData(profile, originalUserAgentData) {
    const lowEntropy = profile.userAgentData;
    const highEntropy = lowEntropy.highEntropyValues || {};
    const brands = lowEntropy.brands?.length ? lowEntropy.brands : originalUserAgentData?.brands || [];

    return {
      brands,
      mobile: false,
      platform: lowEntropy.platform,
      toJSON() {
        return {
          brands: this.brands,
          mobile: this.mobile,
          platform: this.platform
        };
      },
      getHighEntropyValues(hints) {
        if (!Array.isArray(hints)) {
          return Promise.reject(new TypeError("Failed to execute 'getHighEntropyValues' on 'NavigatorUAData'"));
        }

        const applyOverrides = (realValues = {}) => {
          const result = {
            ...this.toJSON(),
            ...realValues
          };

          for (const hint of hints) {
            if (Object.prototype.hasOwnProperty.call(highEntropy, hint)) {
              result[hint] = highEntropy[hint];
            }
          }

          result.mobile = false;
          result.platform = lowEntropy.platform;

          return result;
        };

        if (originalUserAgentData?.getHighEntropyValues) {
          return originalUserAgentData.getHighEntropyValues(hints).then(applyOverrides);
        }

        return Promise.resolve(applyOverrides());
      }
    };
  }

  const profile = readProfile();

  if (!profile) {
    return;
  }

  try {
    defineNavigatorGetter("userAgent", profile.userAgent);
    defineNavigatorGetter("appVersion", profile.appVersion);
    defineNavigatorGetter("platform", profile.platform);

    if ("userAgentData" in navigator && profile.userAgentData) {
      const userAgentData = buildUserAgentData(profile, navigator.userAgentData);

      defineNavigatorGetter("userAgentData", userAgentData);
    }
  } catch (error) {
    console.error("OS_HEADER_SWITCHER_OVERRIDE_FAILED", error);
  }
})();
