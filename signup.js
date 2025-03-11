document
  .getElementById("signupForm")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const rePassword = document.getElementById("rePassword").value;

    const rePasswordError = document.getElementById("rePasswordError");
    if (password !== rePassword) {
      rePasswordError.textContent = "Passwords do not match.";
      return;
    } else {
      rePasswordError.textContent = "";
    }

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
  });
