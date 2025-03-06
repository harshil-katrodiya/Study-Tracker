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

  function updateStatsDisplay(sessionData) {
    const today = new Date().toISOString().split("T")[0];
    const stats = sessionData.dailyStats[today] || {};

    const statsList = Object.entries(stats)
      .filter(([key]) => key !== "visitedUrls")
      .map(([domain, seconds]) => {
        const minutes = Math.floor(seconds / 60);
        return `<li>${domain}: ${minutes}m (${seconds}s)</li>`;
      });

    elements.stats.innerHTML = statsList.length
      ? `<ul>${statsList.join("")}</ul>`
      : "No activity today";
  }

  function updateChart(sessionData) {
    if (chart) chart.destroy();

    const today = new Date().toISOString().split("T")[0];
    const stats = sessionData.dailyStats[today] || {};

    const chartData = Object.entries(stats)
      .filter(([key]) => key !== "visitedUrls")
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
});
