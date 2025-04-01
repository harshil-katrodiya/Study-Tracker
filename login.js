document
  .getElementById("loginForm")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }
    try {
      const response = await fetch("http://localhost:5001/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        // Store session data in localStorage
        const sessionData = {
          token: data.token,
          userId: data.userId,
          lastActivity: new Date().getTime(),
          isLoggedIn: true
        };
        localStorage.setItem('session', JSON.stringify(sessionData));
        
        // Store in browser extension storage
        const browserAPI = window.browser || window.chrome;
        browserAPI.storage.local.set(
          { 
            authToken: data.token, 
            userId: data.userId,
            isLoggedIn: true,
            lastActivity: new Date().getTime()
          },
          () => {
            window.location.href = "popup.html";
          }
        );
      } else {
        alert("Login failed: " + data.error);
      }
    } catch (error) {
      console.error("Network error:", error);
      alert("Network error. Please try again.");
    }
  });
