// auth.js - Sistema di autenticazione FUNZIONANTE

(function() {
    'use strict';
    
    // Funzione per verificare se siamo sulla pagina di login
    function isLoginPage() {
        return window.location.pathname.endsWith('login.html') || 
               window.location.pathname.endsWith('/login.html') ||
               window.location.pathname === '/login.html';
    }
    
    // Funzione per verificare autenticazione
    function checkAuth() {
        // Se siamo sulla pagina di login, non fare nulla
        if (isLoginPage()) {
            console.log('📝 Pagina login - skip check');
            return;
        }
        
        // Controlla se l'utente è loggato
        const isLoggedIn = sessionStorage.getItem('isLoggedIn');
        const username = sessionStorage.getItem('username');
        
        console.log('🔍 Check auth:', { isLoggedIn, username });
        
        // Se non è loggato, redirect a login
        if (isLoggedIn !== 'true') {
            console.log('❌ Non autenticato - redirect a login');
            window.location.replace('login.html');
            return;
        }
        
        console.log('✅ Autenticato come:', username);
    }
    
    // Funzione logout (globale)
    window.logout = function() {
        if (confirm('Sei sicuro di voler uscire dal sistema?')) {
            console.log('🚪 Logout...');
            sessionStorage.clear();
            window.location.replace('login.html');
        }
    };
    
    // Esegui check all'avvio
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAuth);
    } else {
        checkAuth();
    }
    
    console.log('🔐 Auth system loaded');
})();
