const API_URL = 'http://localhost:5001';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('donationForm');
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const amountOptions = document.querySelectorAll('.amount-option');
    const customAmountInput = document.getElementById('customAmount');

    // Regular expressions for validation
    const nameRegex = /^[a-zA-Z\s]*$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Handle amount option selection
    amountOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove selected class from all options
            amountOptions.forEach(opt => opt.classList.remove('selected'));
            // Add selected class to clicked option
            option.classList.add('selected');
            // Set custom amount input to selected value
            customAmountInput.value = option.dataset.amount;
        });
    });

    // Real-time validation for full name
    fullNameInput.addEventListener('input', () => {
        validateFullName(fullNameInput.value);
    });

    // Real-time validation for email
    emailInput.addEventListener('input', () => {
        validateEmail(emailInput.value);
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validate all fields
        const isNameValid = validateFullName(fullNameInput.value);
        const isEmailValid = validateEmail(emailInput.value);
        const isAmountValid = validateAmount();

        if (!isNameValid || !isEmailValid || !isAmountValid) {
            return;
        }

        // Get the final amount
        const amount = parseFloat(customAmountInput.value);

        try {
            const response = await fetch('http://localhost:5001/donate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fullName: fullNameInput.value,
                    email: emailInput.value,
                    amount: amount,
                    message: document.getElementById('message').value
                })
            });

            if (response.ok) {
                const data = await response.json();
                // Redirect to Stripe checkout
                window.location.href = data.url;
            } else {
                throw new Error('Payment initiation failed');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('There was an error processing your donation. Please try again.');
        }
    });

    // Validation functions
    function validateFullName(name) {
        const errorElement = document.getElementById('fullNameError');
        errorElement.style.display = 'block';

        if (!name) {
            errorElement.textContent = 'Full name is required';
            return false;
        }
        if (!nameRegex.test(name)) {
            errorElement.textContent = 'Name can only contain letters and spaces';
            return false;
        }
        if (name.length < 2) {
            errorElement.textContent = 'Name must be at least 2 characters long';
            return false;
        }

        errorElement.style.display = 'none';
        return true;
    }

    function validateEmail(email) {
        const errorElement = document.getElementById('emailError');
        errorElement.style.display = 'block';

        if (!email) {
            errorElement.textContent = 'Email is required';
            return false;
        }
        if (!emailRegex.test(email)) {
            errorElement.textContent = 'Please enter a valid email address';
            return false;
        }

        errorElement.style.display = 'none';
        return true;
    }

    function validateAmount() {
        const errorElement = document.getElementById('amountError');
        const amount = parseFloat(customAmountInput.value);
        errorElement.style.display = 'block';

        if (!amount) {
            errorElement.textContent = 'Please select or enter an amount';
            return false;
        }
        if (amount < 1) {
            errorElement.textContent = 'Amount must be at least $1';
            return false;
        }

        errorElement.style.display = 'none';
        return true;
    }
}); 