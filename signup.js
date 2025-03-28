document.getElementById("signupForm").addEventListener("submit", async function (event) {
    event.preventDefault();
  
    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const successMessage = document.getElementById("successMessage");
  
    let valid = true;
  
    const namePattern = /^[A-Za-z]{1,12}$/;
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const passwordPattern = /^(?=.[a-z])(?=.[A-Z])(?=.\d)(?=.[\W_]).{8,}$/;
  
    // Validation
    if (!firstName || !namePattern.test(firstName)) {
      showError("firstNameError", "Only letters allowed (max 12 characters).");
      valid = false;
    } else hideError("firstNameError");
  
    if (!lastName || !namePattern.test(lastName)) {
      showError("lastNameError", "Only letters allowed (max 12 characters).");
      valid = false;
    } else hideError("lastNameError");
  
    if (!email || !emailPattern.test(email)) {
      showError("emailError", "Please enter a valid email address.");
      valid = false;
    } else hideError("emailError");
  
    if (!password || !passwordPattern.test(password)) {
      showError("passwordError", "Password must include uppercase, lowercase, number, and special character.");
      valid = false;
    } else hideError("passwordError");
  
    if (!confirmPassword || password !== confirmPassword) {
      showError("confirmPasswordError", "Passwords don't match.");
      valid = false;
    } else hideError("confirmPasswordError");
  
    if (!valid) return;
  
    try {
      const response = await fetch("http://localhost:5001/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, password })
      });
  
      const data = await response.json();
  
      if (response.ok) {
        successMessage.innerText = "Signup successful!";
        successMessage.style.display = "block";
        successMessage.style.color = "green";
  
        setTimeout(() => {
          window.location.href = "/login.html";
        }, 1500);
      } else {
        alert("Signup failed: " + (data.message || "Unknown error"));
      }
    } catch (error) {
      console.error("Signup error:", error);
      alert("An error occurred. Please try again later.");
    }
  });
  
  function showError(id, message) {
    const errorElement = document.getElementById(id);
    errorElement.innerText = message;
    errorElement.style.display = "block";
  }
  
  function hideError(id) {
    const errorElement = document.getElementById(id);
    errorElement.innerText = "";
    errorElement.style.display = "none";
  }