const API_URL = 'http://localhost:5001';

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('donationForm');
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const customAmountInput = document.getElementById('customAmount');
    const amountOptions = document.querySelectorAll('.amount-option');

    // Add click handlers for amount options
    amountOptions.forEach(option => {
        option.addEventListener('click', function() {
            console.log('Amount option clicked:', this.dataset.amount); // Debug log
            amountOptions.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            customAmountInput.value = this.dataset.amount;
            validateAmount();
        });
    });

    // Add input event listeners
    fullNameInput.addEventListener('input', validateName);
    emailInput.addEventListener('input', validateEmail);
    customAmountInput.addEventListener('input', validateAmount);

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log('Form submitted'); // Debug log

        // Validate all fields
        const isNameValid = validateName();
        const isEmailValid = validateEmail();
        const isAmountValid = validateAmount();

        console.log('Validation results:', { isNameValid, isEmailValid, isAmountValid }); // Debug log

        if (isNameValid && isEmailValid && isAmountValid) {
            try {
                const formData = {
                    fullName: fullNameInput.value.trim(),
                    email: emailInput.value.trim(),
                    amount: parseFloat(customAmountInput.value),
                    message: document.getElementById('message').value.trim()
                };

                console.log('Sending data:', formData); // Debug log

                const response = await fetch('http://localhost:5001/donate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) throw new Error('Network response was not ok');

                const result = await response.json();
                if (result.url) {
                    window.location.href = result.url;
                }
            } catch (error) {
                console.error('Error:', error);
                alert('There was an error processing your donation. Please try again.');
            }
        }
    });

    function validateName() {
        const name = fullNameInput.value.trim();
        const errorElement = document.getElementById('fullNameError');
        
        if (!name) {
            showError(errorElement, 'Name is required');
            return false;
        }
        if (!/^[a-zA-Z\s]{2,50}$/.test(name)) {
            showError(errorElement, 'Please enter a valid name (letters and spaces only)');
            return false;
        }
        
        hideError(errorElement);
        return true;
    }

    function validateEmail() {
        const email = emailInput.value.trim();
        const errorElement = document.getElementById('emailError');
        
        if (!email) {
            showError(errorElement, 'Email is required');
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showError(errorElement, 'Please enter a valid email address');
            return false;
        }
        
        hideError(errorElement);
        return true;
    }

    function validateAmount() {
        const amount = parseFloat(customAmountInput.value);
        const errorElement = document.getElementById('amountError');
        
        if (!amount) {
            showError(errorElement, 'Please enter or select an amount');
            return false;
        }
        if (amount < 1) {
            showError(errorElement, 'Amount must be at least $1');
            return false;
        }
        
        hideError(errorElement);
        return true;
    }

    function showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
    }

    function hideError(element) {
        element.textContent = '';
        element.style.display = 'none';
    }
}); 