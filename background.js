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

let studySessionData = {
  currentDomain: null,
  startTime: null,
  dailyStats: {},
  activeTimers: {},
};

// Restore session data
browser.storage.local.get("studySessionData").then((data) => {
  if (data.studySessionData) {
    studySessionData = data.studySessionData;
  }
});

// Tab monitoring
browser.tabs.onActivated.addListener(handleTabActivation);
browser.tabs.onUpdated.addListener(handleTabUpdate);
browser.tabs.onRemoved.addListener(handleTabRemoval);

setInterval(checkActiveTab, 60000);

async function checkActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.url) handleTabChange(tabs[0]);
}

async function handleTabActivation(activeInfo) {
  const tab = await browser.tabs.get(activeInfo.tabId);
  if (tab?.url && isValidUrl(tab.url)) handleTabChange(tab);
}

function handleTabUpdate(tabId, changeInfo, tab) {
  if (changeInfo.url) handleTabChange(tab);
}

function handleTabRemoval() {
  saveCurrentStats();
}

async function handleTabChange(tab) {
  if (!tab?.url) return;

  const url = new URL(tab.url);
  const domain = url.hostname.replace("www.", "");

  // Save previous domain time
  if (studySessionData.currentDomain) {
    saveCurrentStats();
    clearInterval(
      studySessionData.activeTimers[studySessionData.currentDomain]
    );
  }

  // Initialize new domain
  studySessionData.currentDomain = domain;
  studySessionData.startTime = Date.now();

  const today = new Date().toISOString().split("T")[0];
  studySessionData.dailyStats[today] = studySessionData.dailyStats[today] || {};
  studySessionData.dailyStats[today][domain] =
    studySessionData.dailyStats[today][domain] || 0;

  trackTime(domain);
  storeVisitedUrl(tab.url);
  saveToStorage();
}

function trackTime(domain) {
  if (studySessionData.activeTimers[domain]) {
    clearInterval(studySessionData.activeTimers[domain]);
  }

  studySessionData.activeTimers[domain] = setInterval(() => {
    const elapsedSeconds = Math.floor(
      (Date.now() - studySessionData.startTime) / 1000
    );
    const today = new Date().toISOString().split("T")[0];

    studySessionData.dailyStats[today][domain] += elapsedSeconds;
    studySessionData.startTime = Date.now();
    saveToStorage();

    console.log(`⏳ ${domain}: ${studySessionData.dailyStats[today][domain]}s`);
  }, 1000);
}

function saveCurrentStats() {
  if (!studySessionData.currentDomain || !studySessionData.startTime) return;

  const today = new Date().toISOString().split("T")[0];
  const elapsedSeconds = Math.floor(
    (Date.now() - studySessionData.startTime) / 1000
  );

  studySessionData.dailyStats[today][studySessionData.currentDomain] +=
    elapsedSeconds;
  studySessionData.startTime = null;
  saveToStorage();
}

function storeVisitedUrl(url) {
  const today = new Date().toISOString().split("T")[0];
  studySessionData.dailyStats[today] = studySessionData.dailyStats[today] || {};
  studySessionData.dailyStats[today].visitedUrls =
    studySessionData.dailyStats[today].visitedUrls || [];
  studySessionData.dailyStats[today].visitedUrls.push(url);
}

function saveToStorage() {
  browser.storage.local.set({ studySessionData });
}
