document
  .getElementById("loginForm")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const emailError = document.getElementById("emailError");
    const passwordError = document.getElementById("passwordError");

    // Clear previous error messages
    emailError.textContent = "";
    passwordError.textContent = "";

    // Validation
    let isValid = true;

    if (!email) {
      emailError.textContent = "Email is required.";
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      emailError.textContent = "Email is invalid.";
      isValid = false;
    }
    if (!password) {
      passwordError.textContent = "Password is required.";
      isValid = false;
    } else if (password.length < 6) {
      passwordError.textContent =
        "Password must be at least 6 characters long.";
      isValid = false;
    }

    if (isValid) {
      // Retrieve user data from local storage
      const userData = JSON.parse(localStorage.getItem("user"));

      // Check if user data exists and credentials match
      if (
        userData &&
        userData.email === email &&
        userData.password === password
      ) {
        // Redirect to the main app or display the graph
        window.location.href = "popup.html"; // Redirect to popup.html
      } else {
        passwordError.textContent = "Invalid email or password.";
        passwordError.style.color = "red";
      }
    }
  });
