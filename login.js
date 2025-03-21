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
        // Create session immediately after successful login
        const session = {
          token: data.token, // Use the token from your server response
          lastActivity: new Date().getTime(),
          userId: data.userId // Assuming your server sends a userId
        };

        // Save session and user data
        localStorage.setItem('session', JSON.stringify(session));
        localStorage.setItem('user', JSON.stringify({
          email: email,
          userId: data.userId,
          // Add any other user data from your server response
        }));

        // Redirect to popup
        window.location.href = 'popup.html';
      } else {
        alert("Login failed: " + data.error);
      }
    } catch (error) {
      console.error("Network error:", error);
      alert("Network error. Please try again.");
    }
  });
