// login.js - Login con database e bcrypt

document.addEventListener('DOMContentLoaded', function() {
    console.log('📝 Login page loaded');
    
    // Se già loggato, vai a index
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        console.log('✅ Già loggato - redirect a index');
        window.location.replace('index.html');
        return;
    }
    
    const form = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const btnLogin = document.getElementById('btnLogin');
    const errorMessage = document.getElementById('errorMessage');
    
    // Focus su username
    usernameInput.focus();
    
    // Gestione form
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!username || !password) {
            errorMessage.textContent = '⚠️ Inserisci username e password';
            errorMessage.style.display = 'block';
            return;
        }
        
        console.log('🔑 Tentativo login:', username);
        
        // Disabilita form
        btnLogin.disabled = true;
        btnLogin.textContent = '⏳ Verifica credenziali...';
        errorMessage.style.display = 'none';
        
        try {
            // Chiamata al backend
            const response = await fetch('/.netlify/functions/auth-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            console.log('📨 Risposta server:', data);
            
            if (response.ok && data.success) {
                console.log('✅ Login valido!');
                
                // Salva sessione
                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('username', data.user.username);
                sessionStorage.setItem('userId', data.user.id);
                sessionStorage.setItem('nome', data.user.nome);
                sessionStorage.setItem('cognome', data.user.cognome);
                sessionStorage.setItem('ruolo', data.user.ruolo);
                sessionStorage.setItem('loginTime', new Date().toISOString());
                
                console.log('💾 Session salvata');
                
                // Redirect a index
                window.location.replace('index.html');
            } else {
                console.log('❌ Login fallito:', data.error);
                
                // Mostra errore
                errorMessage.textContent = `❌ ${data.error || 'Errore durante il login'}`;
                errorMessage.style.display = 'block';
                
                // Riabilita form
                btnLogin.disabled = false;
                btnLogin.textContent = 'Accedi al Sistema';
                
                // Focus su password
                passwordInput.focus();
                passwordInput.select();
            }
        } catch (error) {
            console.error('❌ Errore connessione:', error);
            
            errorMessage.textContent = '❌ Errore di connessione al server';
            errorMessage.style.display = 'block';
            
            btnLogin.disabled = false;
            btnLogin.textContent = 'Accedi al Sistema';
        }
    });
    
    // Enter su password
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            form.dispatchEvent(new Event('submit'));
        }
    });
});
