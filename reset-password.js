document.getElementById("resetPasswordForm").addEventListener("submit", async function (e) {
    e.preventDefault();
  
    const newPassword = document.getElementById("newPassword").value.trim();
    const confirmPassword = document.getElementById("confirmPassword").value.trim();
    const errorDiv = document.getElementById("passwordError");
    const email = localStorage.getItem("resetEmail");
  
    // Password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 digit, and 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  
    // Reset error message
    errorDiv.textContent = "";
  
    if (!newPassword || !confirmPassword) {
      errorDiv.textContent = "Both password fields are required.";
      return;
    }
  
    if (!passwordRegex.test(newPassword)) {
      errorDiv.textContent = "Password must be at least 8 characters long and include 1 uppercase, 1 lowercase, 1 number, and 1 special character.";
      return;
    }
  
    if (newPassword !== confirmPassword) {
      errorDiv.textContent = "Passwords do not match.";
      return;
    }
  
    try {
      const response = await fetch("http://localhost:5001/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword }),
      });
  
      const data = await response.json();
      if (response.ok) {
        alert("Password reset successful! Redirecting to login...");
        localStorage.removeItem("resetEmail");
        window.location.href = "login.html";
      } else {
        errorDiv.textContent = data.message;
      }
    } catch (error) {
      console.error("Reset password error:", error);
      errorDiv.textContent = "Something went wrong. Please try again.";
    }
  });
  