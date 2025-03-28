console.log("Background script is running");

const browserAPI = window.browser || window.chrome;
console.log(
  "Using browser API:",
  browserAPI === window.browser ? "Firefox" : "Chrome"
);

// URL validation function
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return !(
      urlObj.protocol === "moz-extension:" ||
      urlObj.protocol === "about:" ||
      urlObj.protocol === "resource:"
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
  lastUpdate: null, // Add this to track last update time
};

// Add after studySessionData declaration
let whitelistedDomains = [];

// Common resource domains for popular websites
const resourceDomains = {
  "amazon.com": [
    "amazon.com",
    "amazonaws.com",
    "media-amazon.com",
    "ssl-images-amazon.com",
    "images-amazon.com",
    "cloudfront.net",
  ],
  "amazon.ca": [
    "amazon.ca",
    "amazonaws.com",
    "media-amazon.com",
    "ssl-images-amazon.com",
    "images-amazon.com",
    "cloudfront.net",
  ],
  "coursera.org": [
    "coursera.org",
    "coursera-assets.org",
    "coursera-course-photos.s3.amazonaws.com",
    "coursera-university-assets.s3.amazonaws.com",
  ],
  // Add more websites as needed
};

// Initialize data from storage
browserAPI.storage.local
  .get(["whitelistedDomains", "studySessionData"])
  .then((data) => {
    console.log("Initializing data from storage:", data);
    if (data.whitelistedDomains) {
      whitelistedDomains = data.whitelistedDomains;
      console.log("Loaded whitelisted domains:", whitelistedDomains);
    }
    if (data.studySessionData) {
      studySessionData = data.studySessionData;
      console.log("Loaded study session data:", studySessionData);
    }
  })
  .catch((error) => {
    console.error("Error initializing data:", error);
  });

// Tab monitoring: Listen for tab activation, update, and removal
browserAPI.tabs.onActivated.addListener(handleTabActivation);
browserAPI.tabs.onUpdated.addListener(handleTabUpdate);
browserAPI.tabs.onRemoved.addListener(handleTabRemoval);

// Periodic check to detect tab changes
setInterval(checkActiveTab, 60000);

async function checkActiveTab() {
  const tabs = await browserAPI.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (tabs[0]?.url) handleTabChange(tabs[0]);
}

// Handle tab activation
async function handleTabActivation(activeInfo) {
  const tab = await browserAPI.tabs.get(activeInfo.tabId);
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

  // Save stats for previous domain
  if (studySessionData.currentDomain) {
    saveCurrentStats();
    clearInterval(
      studySessionData.activeTimers[studySessionData.currentDomain]
    );
  }

  // Check if new domain is whitelisted
  if (shouldAllowDomain(domain)) {
    // Set new domain and start time
    studySessionData.currentDomain = domain;
    studySessionData.startTime = Date.now();
    studySessionData.lastUpdate = Date.now();

    // Initialize daily stats
    const today = new Date().toISOString().split("T")[0];
    studySessionData.dailyStats[today] =
      studySessionData.dailyStats[today] || {};
    studySessionData.dailyStats[today][domain] =
      studySessionData.dailyStats[today][domain] || 0;

    // Start tracking time
    trackTime(domain);
    storeVisitedUrl(tab.url);
  } else {
    studySessionData.currentDomain = null;
    studySessionData.startTime = null;
    studySessionData.lastUpdate = null;
  }

  saveToStorage();
}

browser.storage.local.get("authToken").then(async (result) => {
  const token = result.authToken;
  if (!token) {
    console.log("No auth token found, skipping sending study data.");
    return;
  }
});

// Periodically send study data to server (every 1 minutes)
setInterval(sendStudyData, 1 * 60 * 1000);
// Also send study data on beforeunload event
window.addEventListener("beforeunload", sendStudyData);

async function sendStudyData() {
  console.log("Sending study data");
  browser.storage.local.get(["authToken", "userId"]).then(async (result) => {
    const token = result.authToken;
    const userId = result.userId; // Not used in payload since verifyToken sets req.userId
    if (!token) {
      console.log("No auth token found, skipping sending study data.");
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    const timeSpentInSeconds =
      studySessionData.dailyStats[today]?.[studySessionData.currentDomain];
    // If timeSpentInSeconds is undefined, then there is nothing to send.
    if (!studySessionData.currentDomain || timeSpentInSeconds === undefined) {
      console.log("No study data available to send.");
      return;
    }
    const payload = {
      site: studySessionData.currentDomain,
      timeSpentInSeconds,
    };
    console.log("Sending study data with payload:", payload);
    try {
      const response = await fetch("http://localhost:5001/saveStudyData", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      console.log("Response from server:", data);
    } catch (error) {
      console.error("Error sending study data:", error);
    }
  });
}

// ========================== TIME TRACKING LOGIC ========================== //

// Track time spent on the current domain
function trackTime(domain) {
  if (studySessionData.activeTimers[domain]) {
    clearInterval(studySessionData.activeTimers[domain]);
  }

  studySessionData.activeTimers[domain] = setInterval(() => {
    const now = Date.now();
    const today = new Date().toISOString().split("T")[0];

    // Initialize daily stats if needed
    studySessionData.dailyStats[today] =
      studySessionData.dailyStats[today] || {};
    studySessionData.dailyStats[today][domain] =
      studySessionData.dailyStats[today][domain] || 0;

    if (studySessionData.lastUpdate) {
      // Calculate elapsed time since last update
      const elapsedSeconds = Math.floor(
        (now - studySessionData.lastUpdate) / 1000
      );
      if (elapsedSeconds > 0) {
        studySessionData.dailyStats[today][domain] += elapsedSeconds;
      }
    }

    studySessionData.lastUpdate = now;
    saveToStorage();
  }, 1000);
}

// Save current session time to the daily stats
function saveCurrentStats() {
  if (!studySessionData.currentDomain || !studySessionData.startTime) return;

  const now = Date.now();
  const today = new Date().toISOString().split("T")[0];

  // Calculate elapsed time
  const elapsedSeconds = Math.floor((now - studySessionData.startTime) / 1000);

  if (elapsedSeconds > 0) {
    // Initialize if needed
    studySessionData.dailyStats[today] =
      studySessionData.dailyStats[today] || {};
    studySessionData.dailyStats[today][studySessionData.currentDomain] =
      studySessionData.dailyStats[today][studySessionData.currentDomain] || 0;

    // Add elapsed time
    studySessionData.dailyStats[today][studySessionData.currentDomain] +=
      elapsedSeconds;
  }

  studySessionData.startTime = now;
  studySessionData.lastUpdate = now;
  saveToStorage();
}

// Store the visited URL in the daily stats
function storeVisitedUrl(url) {
  const today = new Date().toISOString().split("T")[0];
  studySessionData.dailyStats[today] = studySessionData.dailyStats[today] || {};
  studySessionData.dailyStats[today].visitedUrls =
    studySessionData.dailyStats[today].visitedUrls || [];
  studySessionData.dailyStats[today].visitedUrls.push(url);
}

// Save the study session data to local storage
function saveToStorage() {
  try {
    browserAPI.storage.local
      .set({ studySessionData })
      .catch((error) => console.error("Error saving to storage:", error));
  } catch (error) {
    console.error("Error in saveToStorage:", error);
  }
}

// Check if a domain should be allowed
function shouldAllowDomain(domain) {
  // If whitelist is empty, allow all
  if (whitelistedDomains.length === 0) return true;

  // Direct match in whitelist
  if (whitelistedDomains.includes(domain)) return true;

  // Check if domain is a subdomain of any whitelisted domain
  const isDomainWhitelisted = whitelistedDomains.some((whiteDomain) => {
    return domain === whiteDomain || domain.endsWith("." + whiteDomain);
  });

  if (isDomainWhitelisted) return true;

  // Check resource domains
  for (const mainDomain of whitelistedDomains) {
    if (resourceDomains[mainDomain]) {
      if (
        resourceDomains[mainDomain].some(
          (resourceDomain) =>
            domain === resourceDomain || domain.endsWith("." + resourceDomain)
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

// Website blocking implementation
browserAPI.webRequest.onBeforeRequest.addListener(
  function (details) {
    try {
      // Always allow extension and browser resources
      if (
        details.url.startsWith("moz-extension://") ||
        details.url.startsWith("about:") ||
        details.url.startsWith("resource:")
      ) {
        return { cancel: false };
      }

      const url = new URL(details.url);
      const domain = url.hostname.replace(/^www\./, "");

      return { cancel: !shouldAllowDomain(domain) };
    } catch (error) {
      console.error("Error processing URL:", error);
      return { cancel: false };
    }
  },
  {
    urls: ["<all_urls>"],
    types: [
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
      "other",
    ],
  },
  ["blocking"]
);

// Handle messages from popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_WHITELIST") {
    sendResponse({ domains: whitelistedDomains });
  } else if (request.type === "UPDATE_WHITELIST") {
    whitelistedDomains = request.domains;
    browserAPI.storage.local.set({ whitelistedDomains });
    sendResponse({ success: true });
  } else if (request.action === "openDonate") {
    browserAPI.tabs.create({ url: browserAPI.runtime.getURL("donate.html") });
  }
  return true;
});

// Check session status periodically
setInterval(checkSession, 5 * 60 * 1000); // Check every 5 minutes

function checkSession() {
  const session = JSON.parse(localStorage.getItem("session"));
  if (!session || !session.token) return;

  const expirationTime = 24 * 60 * 60 * 1000; // 24 hours
  const now = new Date().getTime();

  if (now - session.lastActivity > expirationTime) {
    // Session expired, clear data
    localStorage.removeItem("session");
    localStorage.removeItem("user");
  }
}

// Add periodic cleanup of old data
function cleanupOldData() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const date in studySessionData.dailyStats) {
    if (new Date(date) < thirtyDaysAgo) {
      delete studySessionData.dailyStats[date];
    }
  }
  saveToStorage();
}

// Run cleanup daily
setInterval(cleanupOldData, 24 * 60 * 60 * 1000);

// Add visibility change handler
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    saveCurrentStats();
  } else if (studySessionData.currentDomain) {
    studySessionData.startTime = Date.now();
    studySessionData.lastUpdate = Date.now();
  }
});

// Add before unload handler
window.addEventListener("beforeunload", () => {
  saveCurrentStats();
  sendStudyData(); // Send data when popup closes
});
