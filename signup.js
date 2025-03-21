document.getElementById("signupForm").addEventListener("submit", function (event) {
  event.preventDefault(); // Prevent form submission

  // Get input values
  const firstName = document.getElementById("firstName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const successMessage = document.getElementById("successMessage");

  let valid = true; // Flag to check overall form validity

  // Regex patterns
  const namePattern = /^[A-Za-z]{1,12}$/;
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

  // First Name Validation
  if (!firstName) {
      showError("firstNameError", "First name should not be empty.");
      valid = false;
  } else if (!namePattern.test(firstName)) {
      showError("firstNameError", "Only letters allowed (max 12 characters).");
      valid = false;
  } else {
      hideError("firstNameError");
  }

  // Last Name Validation
  if (!lastName) {
      showError("lastNameError", "Last name should not be empty.");
      valid = false;
  } else if (!namePattern.test(lastName)) {
      showError("lastNameError", "Only letters allowed (max 12 characters).");
      valid = false;
  } else {
      hideError("lastNameError");
  }

  // Email Validation
  if (!email) {
      showError("emailError", "Email should not be empty.");
      valid = false;
  } else if (!emailPattern.test(email)) {
      showError("emailError", "Please enter a valid email address.");
      valid = false;
  } else {
      hideError("emailError");
  }

  // Password Validation
  if (!password) {
      showError("passwordError", "Password should not be empty.");
      valid = false;
  } else if (!passwordPattern.test(password)) {
      showError(
          "passwordError",
          "Your password must contain at least 1 uppercase letter, 1 lowercase letter, 1 digit, and 1 special character."
      );
      valid = false;
  } else {
      hideError("passwordError");
  }

  // Confirm Password Validation
  if (!confirmPassword) {
      showError("confirmPasswordError", "Please confirm your password.");
      valid = false;
  } else if (password !== confirmPassword) {
      showError("confirmPasswordError", "Passwords don't match.");
      valid = false;
  } else {
      hideError("confirmPasswordError");
  }

  // If everything is valid, show success message
  if (valid) {
      successMessage.innerText = "Signup successful!";
      successMessage.style.display = "block";
      successMessage.style.color = "green";

      // Simulate a short delay before submitting
      setTimeout(() => {
          this.submit(); // Submit the form
      }, 2000);
  }
});

// Function to show error messages
function showError(id, message) {
  const errorElement = document.getElementById(id);
  errorElement.innerText = message;
  errorElement.style.display = "block";
}

// Function to hide error messages
function hideError(id) {
  const errorElement = document.getElementById(id);
  errorElement.innerText = "";
  errorElement.style.display = "none";
}
