document.addEventListener("DOMContentLoaded", async () => {
  const browser = window.browser || window.chrome;
  const elements = {
    timer: document.getElementById("startTime"),
    domain: document.getElementById("currentDomain"),
    stats: document.getElementById("studyStats"),
    chart: document.getElementById("statsChart").getContext("2d"),
    themeToggle: document.getElementById("themeToggle"),
    themeIcon: document.getElementById("themeIcon"),
  };

  // Check authentication status first
  const isLoggedIn = await checkAuthStatus();
  if (!isLoggedIn) {
    window.location.href = "login.html";
    return;
  }

  let chart = null;
  let timerInterval = null;

  // Add new elements
  const domainInput = document.getElementById("domainInput");
  const addDomainButton = document.getElementById("addDomain");
  const whitelistContainer = document.getElementById("whitelistedDomains");

  // Initialize theme
  initializeTheme();

  // Add theme toggle event listener
  elements.themeToggle.addEventListener("click", toggleTheme);

  // Load whitelist and add event listeners
  loadWhitelist();
  addDomainButton.addEventListener("click", addDomain);
  domainInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addDomain();
  });

  // Initial load
  loadData();
  setInterval(loadData, 60000);

  // Add logout button handler
  document.getElementById("logoutBtn").addEventListener("click", handleLogout);

  // Listen for theme changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "data-theme") {
        updateChartTheme();
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  // Authentication functions
  async function checkAuthStatus() {
    try {
      // Check browser storage first
      const storageData = await browser.storage.local.get([
        "isLoggedIn",
        "lastActivity",
      ]);

      // Check localStorage as backup
      const localSession = JSON.parse(localStorage.getItem("session"));

      if (storageData.isLoggedIn && storageData.lastActivity) {
        // Check if session is expired (24 hours)
        const now = new Date().getTime();
        const lastActivity = storageData.lastActivity;
        const sessionExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

        if (now - lastActivity < sessionExpiry) {
          return true;
        } else {
          // Session expired, clear storage
          await clearSession();
          return false;
        }
      } else if (
        localSession &&
        localSession.isLoggedIn &&
        localSession.lastActivity
      ) {
        // Restore session from localStorage if browser storage is empty
        await browser.storage.local.set(localSession);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking auth status:", error);
      return false;
    }
  }

  async function clearSession() {
    try {
      // Clear browser storage
      await browser.storage.local.clear();

      // Clear localStorage
      localStorage.removeItem("session");

      // Redirect to login page
      window.location.href = "login.html";
    } catch (error) {
      console.error("Error clearing session:", error);
    }
  }

  async function updateLastActivity() {
    try {
      const now = new Date().getTime();

      // Update browser storage
      await browser.storage.local.set({ lastActivity: now });

      // Update localStorage
      const session = JSON.parse(localStorage.getItem("session"));
      if (session) {
        session.lastActivity = now;
        localStorage.setItem("session", JSON.stringify(session));
      }
    } catch (error) {
      console.error("Error updating last activity:", error);
    }
  }

  function handleLogout() {
    clearSession();
  }

  // Update last activity on user interaction
  document.addEventListener("click", updateLastActivity);
  document.addEventListener("keypress", updateLastActivity);

  function initializeTheme() {
    // Get saved theme from storage
    browser.storage.local.get(["theme"], (result) => {
      const savedTheme = result.theme || "light";
      document.documentElement.setAttribute("data-theme", savedTheme);
      elements.themeIcon.textContent = savedTheme === "light" ? "🌙" : "☀️";
    });
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "light" ? "dark" : "light";

    // Save theme preference
    browser.storage.local.set({ theme: newTheme }, () => {
      document.documentElement.setAttribute("data-theme", newTheme);
      elements.themeIcon.textContent = newTheme === "light" ? "🌙" : "☀️";
    });
  }

  async function loadData() {
    try {
      const data = await browser.storage.local.get("studySessionData");
      if (!data.studySessionData) return;

      updateTimerDisplay(data.studySessionData);
      updateStatsDisplay(data.studySessionData);
      updateChart(data.studySessionData);
    } catch (error) {
      elements.stats.innerHTML = "Error loading data";
    }
  }

  function updateTimerDisplay(sessionData) {
    clearInterval(timerInterval);

    if (!sessionData.currentDomain || !sessionData.startTime) {
      elements.timer.textContent = "No active session";
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const storedSeconds =
      sessionData.dailyStats[today]?.[sessionData.currentDomain] || 0;

    timerInterval = setInterval(() => {
      const liveSeconds = Math.floor(
        (Date.now() - sessionData.startTime) / 1000
      );
      const totalSeconds = storedSeconds + liveSeconds;
      elements.timer.textContent =
        formatTime(totalSeconds * 1000) +
        (sessionData.isPaused ? " (Paused)" : "");
    }, 1000);

    elements.domain.textContent = sessionData.currentDomain;
  }

  async function updateStatsDisplay(sessionData) {
    const response = await browser.runtime.sendMessage({
      type: "GET_WHITELIST",
    });
    const whitelistedDomains = response.domains;

    const today = new Date().toISOString().split("T")[0];
    const stats = sessionData.dailyStats[today] || {};

    const statsList = Object.entries(stats)
      .filter(([key]) => {
        // Show all domains if whitelist is empty, otherwise show only whitelisted domains
        return (
          key !== "visitedUrls" &&
          (whitelistedDomains.length === 0 || whitelistedDomains.includes(key))
        );
      })
      .map(([domain, seconds]) => {
        const minutes = Math.floor(seconds / 60);
        return `<li>${domain}: ${minutes}m (${seconds}s)</li>`;
      });

    elements.stats.innerHTML = statsList.length
      ? `<ul>${statsList.join("")}</ul>`
      : "No activity today";
  }

  function getChartColors() {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    return {
      backgroundColor: isDark
        ? "rgba(75, 192, 192, 0.1)"
        : "rgba(75, 192, 192, 0.2)",
      borderColor: isDark ? "rgba(75, 192, 192, 0.8)" : "rgba(75, 192, 192, 1)",
      textColor: isDark ? "#ffffff" : "#333333",
    };
  }

  function updateChartTheme() {
    if (chart) {
      const colors = getChartColors();
      chart.options.scales.y.grid.color = colors.borderColor;
      chart.options.scales.x.grid.color = colors.borderColor;
      chart.options.scales.y.ticks.color = colors.textColor;
      chart.options.scales.x.ticks.color = colors.textColor;
      chart.update();
    }
  }

  async function updateChart(sessionData) {
    if (chart) chart.destroy();

    const response = await browser.runtime.sendMessage({
      type: "GET_WHITELIST",
    });
    const whitelistedDomains = response.domains;

    const today = new Date().toISOString().split("T")[0];
    const stats = sessionData.dailyStats[today] || {};

    const chartData = Object.entries(stats)
      .filter(([key]) => {
        return (
          key !== "visitedUrls" &&
          (whitelistedDomains.length === 0 || whitelistedDomains.includes(key))
        );
      })
      .map(([domain, seconds]) => ({
        domain,
        minutes: Math.floor(seconds / 60),
      }));

    const colors = getChartColors();

    chart = new Chart(elements.chart, {
      type: "bar",
      data: {
        labels: chartData.map((item) => item.domain),
        datasets: [
          {
            label: "Minutes",
            data: chartData.map((item) => item.minutes),
            backgroundColor: colors.backgroundColor,
            borderColor: colors.borderColor,
            borderWidth: 1,
          },
        ],
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: colors.borderColor,
            },
            ticks: {
              color: colors.textColor,
            },
          },
          x: {
            grid: {
              color: colors.borderColor,
            },
            ticks: {
              color: colors.textColor,
            },
          },
        },
        plugins: {
          legend: {
            labels: {
              color: colors.textColor,
            },
          },
        },
      },
    });
  }

  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  async function loadWhitelist() {
    try {
      const response = await browser.runtime.sendMessage({
        type: "GET_WHITELIST",
      });
      displayWhitelistedDomains(response.domains);
    } catch (error) {
      console.error("Error loading whitelist:", error);
    }
  }

  function displayWhitelistedDomains(domains) {
    whitelistContainer.innerHTML = domains
      .map(
        (domain) => `
      <li>
        <span>${domain}</span>
        <span class="remove-domain" data-domain="${domain}">×</span>
      </li>
    `
      )
      .join("");

    document.querySelectorAll(".remove-domain").forEach((button) => {
      button.addEventListener("click", removeDomain);
    });
  }

  async function addDomain() {
    let domain = domainInput.value.trim().toLowerCase();
    if (!domain) return;

    try {
      // Clean up domain input
      domain = domain.replace(/^(https?:\/\/)?(www\.)?/i, "");
      domain = domain.split("/")[0]; // Remove paths

      // Basic domain validation
      if (
        !domain.includes(".") ||
        domain.startsWith(".") ||
        domain.endsWith(".")
      ) {
        alert("Please enter a valid domain (e.g., amazon.com)");
        return;
      }

      const response = await browser.runtime.sendMessage({
        type: "GET_WHITELIST",
      });
      const domains = response.domains;

      // Check if domain or similar domain already exists
      if (!domains.includes(domain)) {
        domains.push(domain);
        await browser.runtime.sendMessage({
          type: "UPDATE_WHITELIST",
          domains,
        });
        domainInput.value = "";
        loadWhitelist();
      }
    } catch (error) {
      console.error("Error adding domain:", error);
      alert("Error adding domain. Please try again.");
    }
  }

  async function removeDomain(e) {
    const domainToRemove = e.target.dataset.domain;
    try {
      const response = await browser.runtime.sendMessage({
        type: "GET_WHITELIST",
      });
      const domains = response.domains.filter((d) => d !== domainToRemove);

      await browser.runtime.sendMessage({
        type: "UPDATE_WHITELIST",
        domains,
      });
      loadWhitelist();
    } catch (error) {
      console.error("Error removing domain:", error);
    }
  }
});
