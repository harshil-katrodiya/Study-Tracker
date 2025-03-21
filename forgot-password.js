document.getElementById("forgotPasswordForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const email = document.getElementById("forgotEmail").value.trim();
    const errorDiv = document.getElementById("forgotEmailError");

    if (!email) {
        errorDiv.textContent = "Email is required.";
        return;
    }

    console.log("Sending OTP request for:", email); // Debugging line

    try {
        const response = await fetch("http://localhost:5001/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });

        const data = await response.json();
        console.log("OTP Request Response:", data); // Debugging line

        if (response.ok) {
            alert("OTP sent to your email.");

            // Store email in localStorage for OTP verification step
            localStorage.setItem("resetEmail", email);

            // Show OTP input field and hide email form
            document.getElementById("forgotPasswordForm").style.display = "none";
            document.getElementById("otpForm").style.display = "block";
        } else {
            errorDiv.textContent = data.message;
        }
    } catch (error) {
        console.error("Error sending OTP request:", error);
        errorDiv.textContent = "Something went wrong. Try again.";
    }
});

document.getElementById("otpForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const otp = document.getElementById("otpInput").value.trim();
    const errorDiv = document.getElementById("otpError");
    const email = localStorage.getItem("resetEmail"); // Retrieve stored email

    console.log("Sending OTP verification request with:", { email, otp }); // Debugging line

    if (!otp) {
        errorDiv.textContent = "OTP is required.";
        return;
    }

    try {
        const response = await fetch("http://localhost:5001/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, otp }),
        });

        const data = await response.json();
        console.log("OTP Verification Response:", data); // Debugging line

        if (response.ok) {
            alert("✅ OTP Verified! Redirecting to Reset Password page...");
            window.location.href = "reset-password.html";  // Redirect to password reset page
        } else {
            errorDiv.textContent = data.message;
        }
    } catch (error) {
        console.error("Error verifying OTP:", error);
        errorDiv.textContent = "Something went wrong. Try again.";
    }
});
