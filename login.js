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
        const browserAPI = window.browser || window.chrome;
        browserAPI.storage.local.set(
          { authToken: data.token, userId: data.userId },
          () => {
            console.log(
              "Auth token and userId stored in local storage",
              data.userId,
              data.token
            );
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
