document.getElementById('signupForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rePassword = document.getElementById('rePassword').value;

    // Clear previous error messages
    document.getElementById('firstNameError').textContent = '';
    document.getElementById('lastNameError').textContent = '';
    document.getElementById('emailError').textContent = '';
    document.getElementById('passwordError').textContent = '';
    document.getElementById('rePasswordError').textContent = '';

    // Validation
    let isValid = true;

    if (!firstName) {
        document.getElementById('firstNameError').textContent = "First Name is required.";
        isValid = false;
    }
    if (!lastName) {
        document.getElementById('lastNameError').textContent = "Last Name is required.";
        isValid = false;
    }
    if (!email) {
        document.getElementById('emailError').textContent = "Email is required.";
        isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
        document.getElementById('emailError').textContent = "Email is invalid.";
        isValid = false;
    }
    if (!password) {
        document.getElementById('passwordError').textContent = "Password is required.";
        isValid = false;
    } else if (password.length < 6) {
        document.getElementById('passwordError').textContent = "Password must be at least 6 characters long.";
        isValid = false;
    }
    if (!rePassword) {
        document.getElementById('rePasswordError').textContent = "Re-entering password is required.";
        isValid = false;
    } else if (password !== rePassword) {
        document.getElementById('rePasswordError').textContent = "Passwords do not match.";
        isValid = false;
    }

    if (isValid) {
        // Store user data in local storage
        const userData = {
            firstName,
            lastName,
            email,
            password // In a real application, do not store passwords in plain text
        };
        
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Redirect to login page after successful signup
        window.location.href = 'login.html';
    }
}); 