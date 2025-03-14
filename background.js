console.log("Background script is running");

const browser = window.browser || window.chrome;

// URL validation function
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return !(
      urlObj.href.includes("googletagmanager.com") ||
      urlObj.href.includes("criteo.com") ||
      urlObj.href.includes("qualaroo.com") ||
      urlObj.href.includes("udemycdn.com") ||
      urlObj.href.includes("about:") ||
      urlObj.href.includes("moz-extension:") ||
      urlObj.href.includes("chrome:")
    );
  } catch {
    return false;
  }
}

// Study session data - stores the current domain, start time, daily stats, and active timers.
let studySessionData = {
  currentDomain: null,
  startTime: null,
  dailyStats: {},
  activeTimers: {},
};

// Add after studySessionData declaration
let whitelistedDomains = [];

// Restore study session data from local storage
browser.storage.local.get("studySessionData").then((data) => {
  if (data.studySessionData) {
    studySessionData = data.studySessionData;
  }
});

// Add after storage restoration
browser.storage.local.get("whitelistedDomains").then((data) => {
  if (data.whitelistedDomains) {
    whitelistedDomains = data.whitelistedDomains;
  }
});

// Tab monitoring: Listen for tab activation, update, and removal
browser.tabs.onActivated.addListener(handleTabActivation);
browser.tabs.onUpdated.addListener(handleTabUpdate);
browser.tabs.onRemoved.addListener(handleTabRemoval);

// Periodic check to detect tab changes
setInterval(checkActiveTab, 60000);

async function checkActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.url) handleTabChange(tabs[0]);
}

// Handle tab activation
async function handleTabActivation(activeInfo) {
  const tab = await browser.tabs.get(activeInfo.tabId);
  if (tab?.url && isValidUrl(tab.url)) handleTabChange(tab);
}

// Handle tab update
function handleTabUpdate(tabId, changeInfo, tab) {
  if (changeInfo.url) handleTabChange(tab);
}

// Handle tab removal
function handleTabRemoval() {
  saveCurrentStats();
}

// Handle tab change - updates the current domain and initializes tracking
async function handleTabChange(tab) {
  if (!tab?.url) return;

  const url = new URL(tab.url);
  const domain = url.hostname.replace("www.", "");

  // Only track whitelisted domains if whitelist is not empty
  if (whitelistedDomains.length > 0 && !whitelistedDomains.includes(domain)) {
    // Stop counting time for any domain if the current tab is not whitelisted
    if (studySessionData.currentDomain) {
      saveCurrentStats();
      clearInterval(studySessionData.activeTimers[studySessionData.currentDomain]);
      studySessionData.currentDomain = null; // Reset current domain
    }
    return;
  }

  // Save previous domain session time and clear existing timer
  if (studySessionData.currentDomain) {
    saveCurrentStats();
    clearInterval(studySessionData.activeTimers[studySessionData.currentDomain]);
  }

  // Set new domain and start time
  studySessionData.currentDomain = domain;
  studySessionData.startTime = Date.now();

  // Initialize daily stats for the new domain
  const today = new Date().toISOString().split("T")[0];
  studySessionData.dailyStats[today] = studySessionData.dailyStats[today] || {};
  studySessionData.dailyStats[today][domain] = studySessionData.dailyStats[today][domain] || 0;

  // Start tracking time for the new domain
  trackTime(domain);
  storeVisitedUrl(tab.url);
  saveToStorage();
}

// ========================== TIME TRACKING LOGIC ========================== //

// Track time spent on the current domain
function trackTime(domain) {
  if (studySessionData.activeTimers[domain]) {
    clearInterval(studySessionData.activeTimers[domain]);
  }

  studySessionData.activeTimers[domain] = setInterval(() => {
    const elapsedSeconds = Math.floor((Date.now() - studySessionData.startTime) / 1000);
    const today = new Date().toISOString().split("T")[0];

    studySessionData.dailyStats[today][domain] += elapsedSeconds;
    studySessionData.startTime = Date.now();
    saveToStorage();

  }, 1000);
}

// Save current session time to the daily stats
function saveCurrentStats() {
  if (!studySessionData.currentDomain || !studySessionData.startTime) return;

  const today = new Date().toISOString().split("T")[0];
  const elapsedSeconds = Math.floor((Date.now() - studySessionData.startTime) / 1000);

  studySessionData.dailyStats[today][studySessionData.currentDomain] += elapsedSeconds;
  studySessionData.startTime = null;
  saveToStorage();
}

// Store the visited URL in the daily stats
function storeVisitedUrl(url) {
  const today = new Date().toISOString().split("T")[0];
  studySessionData.dailyStats[today] = studySessionData.dailyStats[today] || {};
  studySessionData.dailyStats[today].visitedUrls = studySessionData.dailyStats[today].visitedUrls || [];
  studySessionData.dailyStats[today].visitedUrls.push(url);
}

// Save the study session data to local storage
function saveToStorage() {
  browser.storage.local.set({ studySessionData });
}

// Add new function to manage whitelist
function updateWhitelist(domains) {
  whitelistedDomains = domains;
  browser.storage.local.set({ whitelistedDomains });
}

// Add message listener for whitelist management
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_WHITELIST") {
    sendResponse({ domains: whitelistedDomains });
  } else if (request.type === "UPDATE_WHITELIST") {
    updateWhitelist(request.domains);
    sendResponse({ success: true });
  }
  return true;
});