// admin.js - Gestione utenti (solo admin)

document.addEventListener('DOMContentLoaded', function() {
    // Verifica che l'utente sia admin
    const ruolo = sessionStorage.getItem('ruolo');
    
    if (ruolo !== 'admin') {
        alert('❌ Accesso negato. Solo gli admin possono accedere a questa pagina.');
        window.location.href = 'index.html';
        return;
    }
    
    caricaUtenti();
    
    // Form crea utente
    document.getElementById('creaUtenteForm').addEventListener('submit', creaUtente);
});

// Crea nuovo utente
async function creaUtente(e) {
    e.preventDefault();
    
    const nome = document.getElementById('nome').value.trim();
    const cognome = document.getElementById('cognome').value.trim();
    const email = document.getElementById('email').value.trim();
    const username = document.getElementById('username').value.trim().toLowerCase();
    const ruolo = document.getElementById('ruolo').value;
    
    const btnCrea = document.getElementById('btnCrea');
    const resultCrea = document.getElementById('resultCrea');
    const errorCrea = document.getElementById('errorCrea');
    
    btnCrea.disabled = true;
    btnCrea.textContent = '⏳ Creazione in corso...';
    resultCrea.style.display = 'none';
    errorCrea.style.display = 'none';
    
    try {
        const response = await fetch('/.netlify/functions/crea-utente', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nome,
                cognome,
                email,
                username,
                ruolo,
                adminUsername: sessionStorage.getItem('username')
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            resultCrea.innerHTML = `
                <h3>✅ Utente creato con successo!</h3>
                <p><strong>Username:</strong> ${data.user.username}</p>
                <p><strong>Password:</strong> <code style="background:#ffeb3b;padding:4px 8px;border-radius:4px;">${data.password}</code></p>
                <p><strong>Email:</strong> ${data.user.email}</p>
                ${data.emailInviata ? 
                    '<p style="color:#4caf50;">✅ Email inviata con successo</p>' : 
                    '<p style="color:#ff9800;">⚠️ Errore invio email - conserva la password!</p>'
                }
                <p style="margin-top:15px;"><small>⚠️ Conserva questa password! Non sarà più visibile.</small></p>
            `;
            resultCrea.style.display = 'block';
            
            // Reset form
            document.getElementById('creaUtenteForm').reset();
            
            // Ricarica lista
            setTimeout(() => caricaUtenti(), 1000);
        } else {
            errorCrea.textContent = `❌ ${data.error || 'Errore durante la creazione'}`;
            errorCrea.style.display = 'block';
        }
    } catch (error) {
        console.error('Errore:', error);
        errorCrea.textContent = '❌ Errore di connessione';
        errorCrea.style.display = 'block';
    } finally {
        btnCrea.disabled = false;
        btnCrea.textContent = '➕ Crea Utente e Invia Email';
    }
}

// Carica lista utenti
async function caricaUtenti() {
    const loadingUtenti = document.getElementById('loadingUtenti');
    const tabellaUtenti = document.getElementById('tabellaUtenti');
    
    loadingUtenti.style.display = 'block';
    tabellaUtenti.style.display = 'none';
    
    try {
        const username = sessionStorage.getItem('username');
        const response = await fetch(`/.netlify/functions/lista-utenti?adminUsername=${username}`);
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            mostraUtenti(data.utenti);
            tabellaUtenti.style.display = 'block';
        } else {
            alert(`❌ ${data.error}`);
        }
    } catch (error) {
        console.error('Errore:', error);
        alert('❌ Errore durante il caricamento degli utenti');
    } finally {
        loadingUtenti.style.display = 'none';
    }
}

// Mostra tabella utenti
function mostraUtenti(utenti) {
    const tbody = document.getElementById('bodyUtenti');
    const currentUsername = sessionStorage.getItem('username');
    
    tbody.innerHTML = utenti.map(u => {
        const ultimoAccesso = u.data_ultimo_accesso ? 
            new Date(u.data_ultimo_accesso).toLocaleDateString('it-IT') : 
            'Mai';
        
        const statoLabel = u.attivo ?
            '<span style="display:inline-block;background:#4caf50;color:white;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600;">✓ Attivo</span>' :
            '<span style="display:inline-block;background:#f44336;color:white;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600;">✗ Disattivo</span>';
        
        const ruoloLabel = u.ruolo === 'admin' ?
            '<span style="display:inline-block;background:#d32f2f;color:white;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">👑 Admin</span>' :
            '<span style="display:inline-block;background:#2196f3;color:white;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:500;text-transform:capitalize;">👤 Operatore</span>';
        
        // Se è l'utente corrente, non mostrare pulsanti
        const isCurrentUser = u.username === currentUsername;
        
        let azioniHtml = '';
        if (isCurrentUser) {
            azioniHtml = '<span style="color:#999;font-style:italic;">Tu stesso</span>';
        } else {
            azioniHtml = `
                ${u.attivo ? 
                    `<button onclick="disattivaUtente(${u.id}, '${u.username}')" 
                            style="background:#ff9800;color:white;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;margin-right:8px;transition:all 0.3s ease;"
                            onmouseover="this.style.background='#f57c00';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(0,0,0,0.2)'"
                            onmouseout="this.style.background='#ff9800';this.style.transform='translateY(0)';this.style.boxShadow='none'">
                        🔒 Disattiva
                    </button>` :
                    `<button onclick="attivaUtente(${u.id}, '${u.username}')" 
                            style="background:#4caf50;color:white;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;margin-right:8px;transition:all 0.3s ease;"
                            onmouseover="this.style.background='#388e3c';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(0,0,0,0.2)'"
                            onmouseout="this.style.background='#4caf50';this.style.transform='translateY(0)';this.style.boxShadow='none'">
                        🔓 Attiva
                    </button>`
                }
                <button onclick="eliminaUtente(${u.id}, '${u.username}')" 
                        style="background:#f44336;color:white;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;transition:all 0.3s ease;"
                        onmouseover="this.style.background='#d32f2f';this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(0,0,0,0.2)'"
                        onmouseout="this.style.background='#f44336';this.style.transform='translateY(0)';this.style.boxShadow='none'">
                    🗑️ Elimina
                </button>
            `;
        }
        
        return `
            <tr>
                <td style="font-weight:600;">${u.username}</td>
                <td>${u.nome} ${u.cognome}</td>
                <td>${u.email}</td>
                <td>${ruoloLabel}</td>
                <td>${statoLabel}</td>
                <td>${ultimoAccesso}</td>
                <td>${azioniHtml}</td>
            </tr>
        `;
    }).join('');
}

// Disattiva utente
async function disattivaUtente(id, username) {
    if (!confirm(`⚠️ Disattivare l'utente ${username}?\n\nL'utente non potrà più accedere al sistema.`)) return;
    
    try {
        const response = await fetch('/.netlify/functions/toggle-utente', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: id,
                azione: 'disattiva',
                adminUsername: sessionStorage.getItem('username')
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            alert(`✅ ${data.message}`);
            caricaUtenti();
        } else {
            alert(`❌ ${data.error}`);
        }
    } catch (error) {
        console.error('Errore:', error);
        alert('❌ Errore durante la disattivazione');
    }
}

// Attiva utente
async function attivaUtente(id, username) {
    if (!confirm(`✅ Attivare l'utente ${username}?`)) return;
    
    try {
        const response = await fetch('/.netlify/functions/toggle-utente', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: id,
                azione: 'attiva',
                adminUsername: sessionStorage.getItem('username')
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            alert(`✅ ${data.message}`);
            caricaUtenti();
        } else {
            alert(`❌ ${data.error}`);
        }
    } catch (error) {
        console.error('Errore:', error);
        alert('❌ Errore durante l\'attivazione');
    }
}

// Elimina utente
async function eliminaUtente(id, username) {
    if (!confirm(`⚠️ ATTENZIONE!\n\nEliminare DEFINITIVAMENTE l'utente ${username}?\n\nQuesta azione è IRREVERSIBILE!`)) return;
    
    if (!confirm(`Sei ASSOLUTAMENTE SICURO di voler eliminare ${username}?\n\nDigita OK per confermare.`)) return;
    
    try {
        const response = await fetch('/.netlify/functions/elimina-utente', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: id,
                adminUsername: sessionStorage.getItem('username')
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            alert(`✅ ${data.message}`);
            caricaUtenti();
        } else {
            alert(`❌ ${data.error}`);
        }
    } catch (error) {
        console.error('Errore:', error);
        alert('❌ Errore durante l\'eliminazione');
    }
}
