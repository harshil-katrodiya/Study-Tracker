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

  // Initial load
  loadData();
  setInterval(loadData, 60000);

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
    const response = await browser.runtime.sendMessage({ type: "GET_WHITELIST" });
    displayWhitelistedDomains(response.domains);
  }

  function displayWhitelistedDomains(domains) {
    whitelistContainer.innerHTML = domains.map(domain => `
      <li class="domain-item">
        <span>${domain}</span>
        <span class="remove-domain" data-domain="${domain}">×</span>
      </li>
    `).join('');

    document.querySelectorAll('.remove-domain').forEach(button => {
      button.addEventListener('click', removeDomain);
    });
  }

  async function addDomain() {
    let domain = domainInput.value.trim().toLowerCase();
    if (!domain) return;

    // Add http:// if no protocol is specified
    if (!domain.includes('://')) {
      domain = domain.replace('http://', '').replace('https://', '');
      domain = domain.split('/')[0]; // Remove any paths
    }

    const response = await browser.runtime.sendMessage({ type: "GET_WHITELIST" });
    const domains = response.domains;

    if (!domains.includes(domain)) {
      domains.push(domain);
      await browser.runtime.sendMessage({ 
        type: "UPDATE_WHITELIST", 
        domains 
      });
      domainInput.value = '';
      loadWhitelist();
    }
  }

  async function removeDomain(e) {
    const domainToRemove = e.target.dataset.domain;
    const response = await browser.runtime.sendMessage({ type: "GET_WHITELIST" });
    const domains = response.domains.filter(d => d !== domainToRemove);
    
    await browser.runtime.sendMessage({ 
      type: "UPDATE_WHITELIST", 
      domains 
    });
    loadWhitelist();
  }
});
