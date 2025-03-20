document
  .getElementById("signupForm")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    // Get form inputs
    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const rePassword = document.getElementById("rePassword").value;

    // Get error fields
    const firstNameError = document.getElementById("firstNameError");
    const lastNameError = document.getElementById("lastNameError");
    const emailError = document.getElementById("emailError");
    const passwordError = document.getElementById("passwordError");
    const rePasswordError = document.getElementById("rePasswordError");

    // Reset previous errors
    firstNameError.textContent = "";
    lastNameError.textContent = "";
    emailError.textContent = "";
    passwordError.textContent = "";
    rePasswordError.textContent = "";

    let isValid = true;

    // Validation checks
    if (!firstName) {
      firstNameError.textContent = "First name is required.";
      isValid = false;
    }
    if (!lastName) {
      lastNameError.textContent = "Last name is required.";
      isValid = false;
    }
    if (!email) {
      emailError.textContent = "Email is required.";
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      emailError.textContent = "Enter a valid email address.";
      isValid = false;
    }
    if (!password) {
      passwordError.textContent = "Password is required.";
      isValid = false;
    } else if (password.length < 6) {
      passwordError.textContent = "Password must be at least 6 characters.";
      isValid = false;
    }
    if (password !== rePassword) {
      rePasswordError.textContent = "Passwords do not match.";
      isValid = false;
    }

    if (!isValid) return; // Stop if validation fails

    try {
      const response = await fetch("http://localhost:5001/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Signup successful!");
        window.location.href = "login.html";
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Network error:", error);
      alert("Network error. Please try again.");
    }
  });
