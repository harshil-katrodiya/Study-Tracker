document.addEventListener("DOMContentLoaded", async () => {
  const browser = window.browser || window.chrome;
  
  // Session Timer variable
  let timerInterval = null;
  
  // Pomodoro Timer functionality
  let pomodoroInterval = null;
  let pomodoroTimeLeft = 0;
  let isStudyTime = true;
  let studyTime = 0;
  let breakTime = 0;
  let isPomodoroRunning = false;
  let wasRunningBeforeHidden = false;

  // Pomodoro Timer elements
  const pomodoroDisplay = document.getElementById('timer');
  const pomodoroLabel = document.getElementById('timerLabel');
  const studyTimeInput = document.getElementById('studyTime');
  const breakTimeInput = document.getElementById('breakTime');
  const startTimerBtn = document.getElementById('startTimer');
  const resetTimerBtn = document.getElementById('resetTimer');

  // Handle tab visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Tab is hidden, pause the timer if it was running
      if (isPomodoroRunning) {
        wasRunningBeforeHidden = true;
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
        savePomodoroState();
      }
    } else {
      // Tab is visible again, resume if it was running before
      if (wasRunningBeforeHidden) {
        wasRunningBeforeHidden = false;
        // Resume from the saved time
        const lastState = browser.storage.local.get(['pomodoroState']).then(data => {
          if (data.pomodoroState && data.pomodoroState.timeLeft > 0) {
            pomodoroTimeLeft = data.pomodoroState.timeLeft;
            isStudyTime = data.pomodoroState.isStudyTime;
            startPomodoroTimer(true);
          }
        });
      }
    }
  });

  // Load saved Pomodoro state
  async function loadPomodoroState() {
    const data = await browser.storage.local.get(['pomodoroState']);
    if (data.pomodoroState) {
      const state = data.pomodoroState;
      // Only restore state if the timer was running and not stopped
      if (state.isRunning && !state.wasStopped) {
        isPomodoroRunning = state.wasHidden ? false : state.isRunning;
        wasRunningBeforeHidden = state.wasHidden && state.isRunning;
        isStudyTime = state.isStudyTime;
        studyTime = state.studyTime;
        breakTime = state.breakTime;
        pomodoroTimeLeft = state.timeLeft;
        
        if (state.isRunning) {
          const timePassed = Math.floor((Date.now() - state.lastUpdate) / 1000);
          pomodoroTimeLeft = Math.max(0, state.timeLeft - timePassed);
          
          updatePomodoroDisplay();
          pomodoroLabel.textContent = isStudyTime ? 'Study Time' : 'Break Time';
          startTimerBtn.textContent = 'Stop Timer';

          if (pomodoroTimeLeft > 0) {
            if (!document.hidden) {
              startPomodoroTimer(true);
            } else {
              wasRunningBeforeHidden = true;
            }
          } else {
            handleTimerComplete();
          }
        }
      }
      
      // Restore input values
      studyTimeInput.value = state.studyTime;
      breakTimeInput.value = state.breakTime;
    }
  }

  // Save Pomodoro state
  async function savePomodoroState() {
    await browser.storage.local.set({
      pomodoroState: {
        isRunning: isPomodoroRunning || wasRunningBeforeHidden,
        isStudyTime: isStudyTime,
        studyTime: parseInt(studyTimeInput.value),
        breakTime: parseInt(breakTimeInput.value),
        timeLeft: pomodoroTimeLeft,
        lastUpdate: Date.now(),
        wasHidden: document.hidden,
        wasStopped: !isPomodoroRunning && !wasRunningBeforeHidden
      }
    });
  }

  // Pomodoro Timer functions
  function formatPomodoroTime(minutes, seconds) {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Request notification permission
  async function requestNotificationPermission() {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  // Show notification
  async function showNotification(title, message) {
    try {
      const browser = window.browser || window.chrome;
      await browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('images/icon128.png'),
        title: title,
        message: message
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  function showPomodoroAlert(message, isBreak = false) {
    // Play notification sound
    const audio = new Audio(isBreak ? 'break.mp3' : 'complete.mp3');
    audio.play().catch(() => {}); // Ignore if sound fails to play

    // Show browser notification
    showNotification(
      isBreak ? 'Break Time!' : 'Study Time Complete!',
      message
    );
  }

  function handleTimerComplete() {
    isPomodoroRunning = false;
    clearInterval(pomodoroInterval);
    pomodoroInterval = null;
    
    if (isStudyTime) {
      showPomodoroAlert('Great job! Time to take a refreshing break! 🎉', true);
      isStudyTime = false;
      pomodoroTimeLeft = breakTime * 60;
      pomodoroLabel.textContent = 'Break Time';
      updatePomodoroDisplay();
      startPomodoroTimer(true);
    } else {
      showPomodoroAlert('Break time is over! Ready for another focused study session? 💪');
      // Reset everything to normal state
      isStudyTime = true;
      pomodoroTimeLeft = 0;
      pomodoroLabel.textContent = 'Study Time';
      pomodoroDisplay.textContent = '00:00';
      
      // Reset button states
      startTimerBtn.textContent = 'Start';
      startTimerBtn.style.background = '#4CAF50';
      startTimerBtn.disabled = false;
      resetTimerBtn.disabled = true;
      
      // Clear the saved state
      browser.storage.local.remove('pomodoroState');
    }
  }

  function startPomodoroTimer(resuming = false) {
    if (!resuming) {
      // Get values from inputs
      studyTime = parseInt(studyTimeInput.value) || 25;
      breakTime = parseInt(breakTimeInput.value) || 5;

      // Validate inputs
      if (studyTime <= 0 || breakTime <= 0) {
        showPomodoroAlert('Please enter valid study and break times');
        return;
      }

      isStudyTime = true;
      pomodoroTimeLeft = studyTime * 60;
    }

    // Clear any existing timer
    if (pomodoroInterval) {
      clearInterval(pomodoroInterval);
    }

    isPomodoroRunning = true;
    updatePomodoroDisplay();
    pomodoroLabel.textContent = isStudyTime ? 'Study Time' : 'Break Time';
    
    // Update button states
    if (isStudyTime) {
      startTimerBtn.textContent = 'Pause';
      startTimerBtn.style.background = '#FFA726';
      startTimerBtn.disabled = false;
    } else {
      startTimerBtn.textContent = 'Break';
      startTimerBtn.style.background = '#4CAF50';
      startTimerBtn.disabled = true;
    }
    resetTimerBtn.disabled = false;

    pomodoroInterval = setInterval(() => {
      if (!isPomodoroRunning) return;
      
      pomodoroTimeLeft--;
      updatePomodoroDisplay();
      savePomodoroState();

      if (pomodoroTimeLeft <= 0) {
        handleTimerComplete();
      }
    }, 1000);
  }

  function pausePomodoroTimer() {
    if (isPomodoroRunning && isStudyTime) {
      isPomodoroRunning = false;
      clearInterval(pomodoroInterval);
      pomodoroInterval = null;
      
      // Update button states
      startTimerBtn.textContent = 'Start';
      startTimerBtn.style.background = '#4CAF50';
      startTimerBtn.disabled = false;
      resetTimerBtn.disabled = false;
      
      savePomodoroState();
    }
  }

  function resetPomodoroTimer() {
    isPomodoroRunning = false;
    if (pomodoroInterval) {
      clearInterval(pomodoroInterval);
      pomodoroInterval = null;
    }
    
    // Reset button states
    startTimerBtn.textContent = 'Start';
    startTimerBtn.style.background = '#4CAF50';
    startTimerBtn.disabled = false;
    resetTimerBtn.disabled = true;
    
    // Reset display
    pomodoroLabel.textContent = 'Study Time';
    isStudyTime = true;
    
    // Reset to user's entered study time
    studyTime = parseInt(studyTimeInput.value) || 25;
    pomodoroTimeLeft = studyTime * 60;
    updatePomodoroDisplay();
    
    // Clear the saved state
    browser.storage.local.remove('pomodoroState');
  }

  function updatePomodoroDisplay() {
    const minutes = Math.floor(pomodoroTimeLeft / 60);
    const seconds = pomodoroTimeLeft % 60;
    pomodoroDisplay.textContent = formatPomodoroTime(minutes, seconds);
  }

  // Pomodoro Timer event listeners
  startTimerBtn.addEventListener('click', () => {
    if (isPomodoroRunning && isStudyTime) {
      pausePomodoroTimer();
    } else {
      // If timer was previously running (paused), resume from current time
      if (pomodoroTimeLeft > 0) {
        startPomodoroTimer(true);
      } else {
        startPomodoroTimer();
      }
    }
  });

  resetTimerBtn.addEventListener('click', resetPomodoroTimer);

  // Reset timer display when inputs change
  studyTimeInput.addEventListener('change', () => {
    if (!isPomodoroRunning) {
      studyTime = parseInt(studyTimeInput.value) || 25;
      pomodoroTimeLeft = studyTime * 60;
      updatePomodoroDisplay();
      savePomodoroState();
    }
  });

  breakTimeInput.addEventListener('change', () => {
    if (!isPomodoroRunning) {
      breakTime = parseInt(breakTimeInput.value) || 5;
      savePomodoroState();
    }
  });

  // Load saved Pomodoro state when popup opens
  loadPomodoroState();

  // Study Session Timer elements
  const elements = {
    sessionTimer: document.getElementById("startTime"),
    domain: document.getElementById("currentDomain"),
    stats: document.getElementById("studyStats"),
    chart: document.getElementById("statsChart").getContext("2d"),
    themeToggle: document.getElementById("themeToggle"),
    themeIcon: document.getElementById("themeIcon")
  };

  // Check authentication status first
  const isLoggedIn = await checkAuthStatus();
  if (!isLoggedIn) {
    window.location.href = 'login.html';
    return;
  }

  let chart = null;

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
      const storageData = await browser.storage.local.get(['isLoggedIn', 'lastActivity']);
      
      // Check localStorage as backup
      const localSession = JSON.parse(localStorage.getItem('session'));
      
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
      } else if (localSession && localSession.isLoggedIn && localSession.lastActivity) {
        // Restore session from localStorage if browser storage is empty
        await browser.storage.local.set(localSession);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking auth status:', error);
      return false;
    }
  }

  async function clearSession() {
    try {
      // Clear browser storage
      await browser.storage.local.clear();
      
      // Clear localStorage
      localStorage.removeItem('session');
      
      // Redirect to login page
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }

  async function updateLastActivity() {
    try {
      const now = new Date().getTime();
      
      // Update browser storage
      await browser.storage.local.set({ lastActivity: now });
      
      // Update localStorage
      const session = JSON.parse(localStorage.getItem('session'));
      if (session) {
        session.lastActivity = now;
        localStorage.setItem('session', JSON.stringify(session));
      }
    } catch (error) {
      console.error('Error updating last activity:', error);
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
    browser.storage.local.get(['theme'], (result) => {
      const savedTheme = result.theme || 'light';
      document.documentElement.setAttribute('data-theme', savedTheme);
      elements.themeIcon.textContent = savedTheme === 'light' ? '🌙' : '☀️';
    });
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    // Save theme preference
    browser.storage.local.set({ theme: newTheme }, () => {
      document.documentElement.setAttribute('data-theme', newTheme);
      elements.themeIcon.textContent = newTheme === 'light' ? '🌙' : '☀️';
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
    if (!sessionData.currentDomain || !sessionData.startTime) {
      elements.sessionTimer.textContent = "No active session";
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const storedSeconds = sessionData.dailyStats[today]?.[sessionData.currentDomain] || 0;

    // Clear any existing interval
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    // Only start the interval if the tab is visible
    if (!document.hidden) {
      const startTime = sessionData.startTime;
      
      timerInterval = setInterval(() => {
        const currentTime = Date.now();
        const liveSeconds = Math.floor((currentTime - startTime) / 1000);
        const totalSeconds = storedSeconds + liveSeconds;
        elements.sessionTimer.textContent = formatTime(totalSeconds * 1000) + 
          (sessionData.isPaused ? " (Paused)" : "");
      }, 1000);
    }

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
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      backgroundColor: isDark ? 'rgba(75, 192, 192, 0.1)' : 'rgba(75, 192, 192, 0.2)',
      borderColor: isDark ? 'rgba(75, 192, 192, 0.8)' : 'rgba(75, 192, 192, 1)',
      textColor: isDark ? '#ffffff' : '#333333'
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
              color: colors.borderColor
            },
            ticks: {
              color: colors.textColor
            }
          },
          x: {
            grid: {
              color: colors.borderColor
            },
            ticks: {
              color: colors.textColor
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: colors.textColor
            }
          }
        }
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
