document.addEventListener("DOMContentLoaded", () => {
  const browser = window.browser || window.chrome;
  const elements = {
    timer: document.getElementById("startTime"),
    domain: document.getElementById("currentDomain"),
    stats: document.getElementById("studyStats"),
    chart: document.getElementById("statsChart").getContext("2d"),
  };

  let chart = null;
  let timerInterval = null;

  // Add new elements
  const domainInput = document.getElementById("domainInput");
  const addDomainButton = document.getElementById("addDomain");
  const whitelistContainer = document.getElementById("whitelistedDomains");

  // Load whitelist and add event listeners
  loadWhitelist();
  addDomainButton.addEventListener("click", addDomain);
  domainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addDomain();
  });

  // Initial load
  loadData();
  setInterval(loadData, 60000);

  // Check session status
  checkSession();

  // Add logout button handler
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

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
      elements.timer.textContent = formatTime(
        (storedSeconds + liveSeconds) * 1000
      );
    }, 1000);

    elements.domain.textContent = sessionData.currentDomain;
  }

  async function updateStatsDisplay(sessionData) {
    const response = await browser.runtime.sendMessage({ type: "GET_WHITELIST" });
    const whitelistedDomains = response.domains;

    const today = new Date().toISOString().split("T")[0];
    const stats = sessionData.dailyStats[today] || {};

    const statsList = Object.entries(stats)
      .filter(([key]) => {
        // Show all domains if whitelist is empty, otherwise show only whitelisted domains
        return key !== "visitedUrls" && 
               (whitelistedDomains.length === 0 || whitelistedDomains.includes(key));
      })
      .map(([domain, seconds]) => {
        const minutes = Math.floor(seconds / 60);
        return `<li>${domain}: ${minutes}m (${seconds}s)</li>`;
      });

    elements.stats.innerHTML = statsList.length
      ? `<ul>${statsList.join("")}</ul>`
      : "No activity today";
  }

  async function updateChart(sessionData) {
    if (chart) chart.destroy();

    const response = await browser.runtime.sendMessage({ type: "GET_WHITELIST" });
    const whitelistedDomains = response.domains;

    const today = new Date().toISOString().split("T")[0];
    const stats = sessionData.dailyStats[today] || {};

    const chartData = Object.entries(stats)
      .filter(([key]) => {
        return key !== "visitedUrls" && 
               (whitelistedDomains.length === 0 || whitelistedDomains.includes(key));
      })
      .map(([domain, seconds]) => ({
        domain,
        minutes: Math.floor(seconds / 60),
      }));

    chart = new Chart(elements.chart, {
      type: "bar",
      data: {
        labels: chartData.map((item) => item.domain),
        datasets: [
          {
            label: "Minutes",
            data: chartData.map((item) => item.minutes),
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            borderColor: "rgba(75, 192, 192, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        scales: {
          y: { beginAtZero: true },
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
      const response = await browser.runtime.sendMessage({ type: 'GET_WHITELIST' });
      displayWhitelistedDomains(response.domains);
    } catch (error) {
      console.error('Error loading whitelist:', error);
    }
  }

  function displayWhitelistedDomains(domains) {
    whitelistContainer.innerHTML = domains.map(domain => `
      <li>
        <span>${domain}</span>
        <span class="remove-domain" data-domain="${domain}">×</span>
      </li>
    `).join('');

    document.querySelectorAll('.remove-domain').forEach(button => {
      button.addEventListener('click', removeDomain);
    });
  }

  // These functions manage the whitelist of domains that are allowed to be accessed.
  async function addDomain() {
    let domain = domainInput.value.trim().toLowerCase();
    if (!domain) return;

    try {
        // Clean up domain input
        domain = domain.replace(/^(https?:\/\/)?(www\.)?/i, '');
        domain = domain.split('/')[0]; // Remove paths

        // Basic domain validation
        if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
            alert('Please enter a valid domain (e.g., amazon.com)');
            return;
        }

        const response = await browser.runtime.sendMessage({ type: 'GET_WHITELIST' });
        const domains = response.domains;

        // Check if domain or similar domain already exists
        if (!domains.includes(domain)) {
            domains.push(domain);
            await browser.runtime.sendMessage({
                type: 'UPDATE_WHITELIST',
                domains
            });
            domainInput.value = '';
            loadWhitelist();
        }
    } catch (error) {
        console.error('Error adding domain:', error);
        alert('Error adding domain. Please try again.');
    }
  }

  async function removeDomain(e) {
    const domainToRemove = e.target.dataset.domain;
    try {
      const response = await browser.runtime.sendMessage({ type: 'GET_WHITELIST' });
      const domains = response.domains.filter(d => d !== domainToRemove);
      
      await browser.runtime.sendMessage({
        type: 'UPDATE_WHITELIST',
        domains
      });
      loadWhitelist();
    } catch (error) {
      console.error('Error removing domain:', error);
    }
  }

  function checkSession() {
    const session = JSON.parse(localStorage.getItem('session'));
    if (!session || !session.token || isSessionExpired(session)) {
      // Redirect to login page if no valid session
      window.location.href = 'login.html';
      return;
    }

    // Session is valid, update last activity
    updateLastActivity();
  }

  function isSessionExpired(session) {
    // Session expires after 24 hours of inactivity
    const expirationTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const now = new Date().getTime();
    return now - session.lastActivity > expirationTime;
  }

  function updateLastActivity() {
    const session = JSON.parse(localStorage.getItem('session'));
    if (session) {
      session.lastActivity = new Date().getTime();
      localStorage.setItem('session', JSON.stringify(session));
    }
  }

  function handleLogout() {
    // Clear session data
    localStorage.removeItem('session');
    localStorage.removeItem('user');
    
    // Redirect to login page
    window.location.href = 'login.html';
  }

  // Update last activity when user interacts with the popup
  document.addEventListener('click', updateLastActivity);
  document.addEventListener('keypress', updateLastActivity);
});
