jQuery(document).ready(function($) {
    var codeInput = document.getElementById('bromate-totp-code');
    var verifyButton = document.getElementById('bromate-totp-verify-button');
    var errorDiv = document.getElementById('bromate-totp-error');
    var rememberCheckbox = document.getElementById('bromate-totp-remember');
    
    if (!codeInput || !verifyButton) {
        return;
    }

    $(codeInput).on('input', function() {
        this.value = this.value.replace(/\D/g, '').slice(0, 6);
        
        if (this.value.length === 6) {
            verifyTotp(this.value);
        }
    });

    $(codeInput).on('keydown', function(e) {
        if (e.key === 'Enter' && this.value.length === 6) {
            e.preventDefault();
            verifyTotp(this.value);
        }
    });

    $(verifyButton).on('click', function(e) {
        e.preventDefault();
        var code = $(codeInput).val().trim();
        if (code.length === 6) {
            verifyTotp(code);
        } else {
            showError('Please enter a valid 6-digit code.');
        }
    });

    function verifyTotp(code) {
        hideError();
        
        var nonceField = document.querySelector('input[name="bromate_totp_nonce"]');
        var sessionField = document.querySelector('input[name="bromate_totp_session"]');
        
        var formData = new FormData();
        formData.append('action', 'bromate_verify_totp');
        formData.append('code', code);
        formData.append('session_id', sessionField ? sessionField.value : bromateTotp.sessionId);
        formData.append('remember_device', rememberCheckbox && rememberCheckbox.checked ? '1' : '0');
        formData.append('nonce', nonceField ? nonceField.value : bromateTotp.nonce);

        $(codeInput).prop('disabled', true);
        $(verifyButton).prop('disabled', true).text('Verifying...');

        $.ajax({
            url: bromateTotp.ajaxUrl,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.success) {
                    finishLogin();
                } else {
                    showError(response.data.message || 'Verification failed. Please try again.');
                    $(codeInput).val('').prop('disabled', false).focus();
                    $(verifyButton).prop('disabled', false).text('Verify');
                    
                    if (response.data.locked) {
                        $(codeInput).prop('disabled', true);
                        $(verifyButton).prop('disabled', true);
                        showError('Too many failed attempts. Please try logging in again.');
                    }
                }
            },
            error: function(xhr, status, error) {
                showError('An error occurred. Please try again.');
                $(codeInput).prop('disabled', false);
                $(verifyButton).prop('disabled', false).text('Verify');
            }
        });
    }

    function finishLogin() {
        var nonceField = document.querySelector('input[name="bromate_totp_nonce"]');
        var sessionField = document.querySelector('input[name="bromate_totp_session"]');
        
        var formData = new FormData();
        formData.append('action', 'bromate_finish_login');
        formData.append('session_id', sessionField ? sessionField.value : bromateTotp.sessionId);
        formData.append('nonce', nonceField ? nonceField.value : bromateTotp.nonce);

        $.ajax({
            url: bromateTotp.ajaxUrl,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.success) {
                    window.location.href = response.data.redirect_url || bromateTotp.redirectUrl;
                } else {
                    showError(response.data.message || 'Login failed. Please try again.');
                    $(codeInput).prop('disabled', false);
                    $(verifyButton).prop('disabled', false).text('Verify');
                }
            },
            error: function() {
                showError('An error occurred while completing login. Please try again.');
                $(codeInput).prop('disabled', false);
                $(verifyButton).prop('disabled', false).text('Verify');
            }
        });
    }

    function showError(message) {
        if (errorDiv) {
            $(errorDiv).text(message).show();
        }
    }

    function hideError() {
        if (errorDiv) {
            $(errorDiv).hide();
        }
    }

    $(codeInput).focus();
});