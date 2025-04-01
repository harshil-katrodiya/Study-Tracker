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
  lastUpdate: null
};

// Add after studySessionData declaration
let whitelistedDomains = [];
let totalBlockedAttempts = 0; // Track total attempts across all blocked sites

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

// Update the excludedDomains array to remove localhost
const excludedDomains = [
  "stripe.com",
  "checkout.stripe.com",
  "pay.stripe.com",
  "billing.stripe.com",
  "dashboard.stripe.com",
  "api.stripe.com",
  "js.stripe.com",
  "hooks.stripe.com",
  "connect.stripe.com",
  "files.stripe.com",
  "m.stripe.com",
  "q.stripe.com",
  "r.stripe.com",
  "s.stripe.com",
  "t.stripe.com",
  "u.stripe.com",
  "v.stripe.com",
  "w.stripe.com",
  "x.stripe.com",
  "y.stripe.com",
  "z.stripe.com"
];

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

// Update isStripeUrl function to remove localhost check
function isStripeUrl(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace("www.", "");
    const path = urlObj.pathname.toLowerCase();

    // Check if domain is Stripe-related
    if (excludedDomains.some(excludedDomain => 
      domain === excludedDomain || domain.endsWith("." + excludedDomain))) {
      return true;
    }

    // Check for Stripe-related paths
    const stripePaths = [
      "/checkout",
      "/payment",
      "/pay",
      "/billing",
      "/subscription",
      "/receipt",
      "/invoice",
      "/payment-methods",
      "/setup",
      "/confirm",
      "/success",
      "/cancel"
    ];

    return stripePaths.some(stripePath => path.startsWith(stripePath));
  } catch {
    return false;
  }
}

// Add function to check if URL is donation page
function isDonationPage(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname === "/donate";
  } catch {
    return false;
  }
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

  // Check if URL is donation page
  if (isDonationPage(tab.url)) {
    studySessionData.currentDomain = null;
    studySessionData.startTime = null;
    studySessionData.lastUpdate = null;
    saveToStorage();
    return;
  }

  // Check if URL is Stripe-related
  if (isStripeUrl(tab.url)) {
    studySessionData.currentDomain = null;
    studySessionData.startTime = null;
    studySessionData.lastUpdate = null;
    saveToStorage();
    return;
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

// Update the token check
browser.storage.local.get("accessToken").then(async (result) => {
  const token = result.accessToken;
  if (!token) {
    console.log("No access token found, skipping sending study data.");
    return;
  }
});

// Periodically send study data to server (every 1 minutes)
setInterval(sendStudyData, 1 * 60 * 1000);
// Also send study data on beforeunload event
window.addEventListener("beforeunload", sendStudyData);

// Add token refresh function
async function refreshAccessToken() {
  try {
    const result = await browser.storage.local.get(["refreshToken"]);
    const refreshToken = result.refreshToken;

    if (!refreshToken) {
      console.log("No refresh token found");
      return false;
    }

    const response = await fetch("http://localhost:5001/refresh-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      await browser.storage.local.set({ accessToken: data.accessToken });
      return true;
    } else {
      console.log("Failed to refresh token");
      return false;
    }
  } catch (error) {
    console.error("Error refreshing token:", error);
    return false;
  }
}

// Update sendStudyData function to handle token refresh
async function sendStudyData() {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const result = await browser.storage.local.get(["accessToken", "userId"]);
      let token = result.accessToken;
      
      if (!token) {
        console.log("No access token found, skipping sending study data.");
        return;
      }

      const today = new Date().toISOString().split("T")[0];
      const timeSpentInSeconds = studySessionData.dailyStats[today]?.[studySessionData.currentDomain];

      if (!studySessionData.currentDomain || timeSpentInSeconds === undefined) {
        console.log("No study data available to send.");
        return;
      }

      const payload = {
        site: studySessionData.currentDomain,
        timeSpentInSeconds,
      };

      let response = await fetch("http://localhost:5001/saveStudyData", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      // If token is expired, try to refresh it
      if (response.status === 401) {
        console.log("Token expired, attempting to refresh...");
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Get the new token and retry the request
          const newResult = await browser.storage.local.get(["accessToken"]);
          token = newResult.accessToken;
          response = await fetch("http://localhost:5001/saveStudyData", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
        } else {
          console.log("Failed to refresh token, user needs to login again");
          return;
        }
      }

      if (response.ok) {
        console.log("Study data sent successfully");
        return;
      }

      throw new Error(`Failed to send data: ${response.statusText}`);
    } catch (error) {
      console.error(`Attempt ${retryCount + 1} failed:`, error);
      retryCount++;
      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 5000 * retryCount)); // Exponential backoff
      }
    }
  }
}

// ========================== TIME TRACKING LOGIC ========================== //

// Track time spent on the current domain
function trackTime(domain) {
  if (studySessionData.activeTimers[domain]) {
    clearInterval(studySessionData.activeTimers[domain]);
  }

  // Update lastUpdate immediately
  studySessionData.lastUpdate = Date.now();

  studySessionData.activeTimers[domain] = setInterval(() => {
    const now = Date.now();
    const today = new Date().toISOString().split("T")[0];

    // Initialize daily stats if needed
    studySessionData.dailyStats[today] = studySessionData.dailyStats[today] || {};
    studySessionData.dailyStats[today][domain] = studySessionData.dailyStats[today][domain] || 0;

    if (studySessionData.lastUpdate) {
      // Calculate elapsed time since last update
      const elapsedSeconds = Math.floor((now - studySessionData.lastUpdate) / 1000);
      if (elapsedSeconds > 0) {
        studySessionData.dailyStats[today][domain] += elapsedSeconds;
      }
    }

    studySessionData.lastUpdate = now;
    saveToStorage();
  }, 5000); // Changed to 5 seconds for better performance
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
    studySessionData.dailyStats[today] = studySessionData.dailyStats[today] || {};
    studySessionData.dailyStats[today][studySessionData.currentDomain] = 
      studySessionData.dailyStats[today][studySessionData.currentDomain] || 0;

    // Add elapsed time to daily stats
    studySessionData.dailyStats[today][studySessionData.currentDomain] += elapsedSeconds;
  }

  // Clear the timer for the current domain
  if (studySessionData.activeTimers[studySessionData.currentDomain]) {
    clearInterval(studySessionData.activeTimers[studySessionData.currentDomain]);
    delete studySessionData.activeTimers[studySessionData.currentDomain];
  }

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

// Update shouldAllowDomain function to remove localhost check
function shouldAllowDomain(domain) {
  // If whitelist is empty, allow all
  if (whitelistedDomains.length === 0) return true;

  // Check if domain is in excluded domains
  if (excludedDomains.some(excludedDomain => 
    domain === excludedDomain || domain.endsWith("." + excludedDomain))) {
    return false;
  }

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

      // Only count attempts for main page loads
      if (!shouldAllowDomain(domain) && details.type === "main_frame") {
        totalBlockedAttempts++;
        console.log("Blocked attempt count:", totalBlockedAttempts);
        
        // If user has attempted to visit any blocked site 3 or more times
        if (totalBlockedAttempts >= 3) {
          console.log("Showing notification for multiple blocked attempts");
          // Show distraction alert notification
          browserAPI.notifications.create({
            type: 'basic',
            iconUrl: browserAPI.runtime.getURL('images/icon128.png'),
            title: 'Study Tracker',
            message: 'Stay focused! Keep up the good work!'
          });
          
          // Reset the counter
          totalBlockedAttempts = 0;
        }
      }

      return { cancel: !shouldAllowDomain(domain) };
    } catch (error) {
      console.error("Error processing URL:", error);
      return { cancel: false };
    }
  },
  {
    urls: ["<all_urls>"],
    types: ["main_frame"], // Only listen for main page loads
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

