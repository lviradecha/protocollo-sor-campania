// ====================================
// REGISTRO ATTESTATI - SOR CAMPANIA
// ====================================

const API_BASE = '/.netlify/functions';
let attestatiCache = [];
let eventiCache = [];

document.addEventListener('DOMContentLoaded', function() {
    console.log('📊 Pagina Registro Attestati caricata');
    caricaRegistroAttestati();
    
    // Event listeners
    document.getElementById('filtroEvento').addEventListener('change', applicaFiltri);
    document.getElementById('filtroRicerca').addEventListener('input', applicaFiltri);
});

async function caricaRegistroAttestati() {
    console.log('🔄 Caricamento registro attestati...');
    
    const loadingSection = document.getElementById('loadingSection');
    const tableSection = document.getElementById('tableSection');
    const emptySection = document.getElementById('emptySection');
    const statsSection = document.getElementById('statsSection');
    
    loadingSection.style.display = 'block';
    tableSection.style.display = 'none';
    emptySection.style.display = 'none';
    statsSection.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE}/get-attestati`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`✅ Caricati ${data.attestati?.length || 0} attestati`);
        
        attestatiCache = data.attestati || [];
        
        if (attestatiCache.length === 0) {
            loadingSection.style.display = 'none';
            emptySection.style.display = 'block';
            return;
        }
        
        // Estrai eventi unici
        eventiCache = [...new Set(attestatiCache.map(a => a.nome_evento))];
        popolaFiltroEventi();
        
        // Mostra statistiche
        mostraStatistiche(attestatiCache);
        
        // Applica filtri
        applicaFiltri();
        
    } catch (error) {
        console.error('❌ Errore caricamento registro:', error);
        loadingSection.style.display = 'none';
        emptySection.style.display = 'block';
        alert('Errore durante il caricamento del registro. Riprova.');
    }
}

function popolaFiltroEventi() {
    const select = document.getElementById('filtroEvento');
    select.innerHTML = '<option value="">Tutti gli eventi</option>';
    
    eventiCache.forEach(evento => {
        const option = document.createElement('option');
        option.value = evento;
        option.textContent = evento;
        select.appendChild(option);
    });
}

function mostraStatistiche(attestati) {
    const statsSection = document.getElementById('statsSection');
    const statsGrid = document.getElementById('statsGrid');
    
    const totale = attestati.length;
    const eventiCount = [...new Set(attestati.map(a => a.nome_evento))].length;
    const ultimi7gg = attestati.filter(a => {
        const data = new Date(a.data_generazione);
        const now = new Date();
        const diff = (now - data) / (1000 * 60 * 60 * 24);
        return diff <= 7;
    }).length;
    
    statsGrid.innerHTML = `
        <div style="background: white; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #d32f2f;">
            <div style="font-size: 28px; font-weight: bold; color: #d32f2f;">${totale}</div>
            <div style="color: #666; font-size: 13px; margin-top: 5px;">📊 Totale Attestati</div>
        </div>
        <div style="background: white; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #1976d2;">
            <div style="font-size: 28px; font-weight: bold; color: #1976d2;">${eventiCount}</div>
            <div style="color: #666; font-size: 13px; margin-top: 5px;">🎯 Eventi Totali</div>
        </div>
        <div style="background: white; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #388e3c;">
            <div style="font-size: 28px; font-weight: bold; color: #388e3c;">${ultimi7gg}</div>
            <div style="color: #666; font-size: 13px; margin-top: 5px;">📅 Ultimi 7 giorni</div>
        </div>
    `;
    
    statsSection.style.display = 'block';
}

function applicaFiltri() {
    const evento = document.getElementById('filtroEvento').value;
    const ricerca = document.getElementById('filtroRicerca').value.toLowerCase();
    
    let attestati = [...attestatiCache];
    
    if (evento) {
        attestati = attestati.filter(a => a.nome_evento === evento);
    }
    
    if (ricerca) {
        attestati = attestati.filter(a => {
            return (
                a.nome?.toLowerCase().includes(ricerca) ||
                a.cognome?.toLowerCase().includes(ricerca) ||
                a.codice_fiscale?.toLowerCase().includes(ricerca) ||
                a.nome_evento?.toLowerCase().includes(ricerca)
            );
        });
    }
    
    mostraTabella(attestati);
}

function mostraTabella(attestati) {
    const tableSection = document.getElementById('tableSection');
    const emptySection = document.getElementById('emptySection');
    const loadingSection = document.getElementById('loadingSection');
    const tableBody = document.getElementById('tableBody');
    
    loadingSection.style.display = 'none';
    
    if (attestati.length === 0) {
        tableSection.style.display = 'none';
        emptySection.style.display = 'block';
        return;
    }
    
    emptySection.style.display = 'none';
    tableSection.style.display = 'block';
    
    // Ordina per data decrescente
    attestati.sort((a, b) => new Date(b.data_generazione) - new Date(a.data_generazione));
    
    tableBody.innerHTML = attestati.map(a => {
        const data = new Date(a.data_generazione);
        const dataFormattata = data.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let driveHtml = '<span style="color: #999; font-size: 10px;">N/A</span>';
        if (a.url_drive) {
            driveHtml = `
                <a href="${a.url_drive}" 
                   target="_blank" 
                   class="btn-drive-small"
                   title="Apri su Google Drive">
                    📄 Drive
                </a>
            `;
        }
        
        // Stato Email
        let emailHtml = '<span style="color: #999; font-size: 10px;">N/A</span>';
        if (a.email_destinatario) {
            if (a.email_inviata) {
                emailHtml = '<span style="background: #4caf50; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: 500; white-space: nowrap;">✓ Inviata</span>';
            } else {
                emailHtml = '<span style="background: #ff9800; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: 500; white-space: nowrap;">✗ Non inviata</span>';
            }
        }
        
        // Controllo ruolo admin per pulsante elimina
        const ruolo = sessionStorage.getItem('ruolo');
        const isAdmin = ruolo === 'admin';
        
        let azioniHtml = '';
        if (isAdmin) {
            azioniHtml = `
                <button onclick="eliminaAttestato(${a.id}, '${a.nome}', '${a.cognome}', '${a.nome_evento}')" 
                        class="btn-elimina-small"
                        title="Elimina attestato">
                    🗑️
                </button>
            `;
        }
        
        return `
            <tr>
                <td title="${a.nome}">${a.nome}</td>
                <td title="${a.cognome}">${a.cognome}</td>
                <td title="${a.codice_fiscale}" style="font-size: 11px;">${a.codice_fiscale}</td>
                <td title="${a.nome_evento}" style="overflow: hidden; text-overflow: ellipsis;">${a.nome_evento}</td>
                <td style="font-size: 11px;">${dataFormattata}</td>
                <td style="text-align: center;">${emailHtml}</td>
                <td style="text-align: center;">${driveHtml}</td>
                <td style="text-align: center;">
                    <button onclick="vediDettagli(${a.id})" 
                            class="btn-secondary" 
                            style="padding: 4px 8px; font-size: 10px;">
                        👁️
                    </button>
                </td>
                <td style="text-align: center;">${azioniHtml}</td>
            </tr>
        `;
    }).join('');
}

async function vediDettagli(id) {
    const attestato = attestatiCache.find(a => a.id === id);
    if (!attestato) return;
    
    const dataFormattata = new Date(attestato.data_generazione).toLocaleString('it-IT');
    
    const dettagliHtml = `
        <div style="max-width: 700px; margin: 0 auto;">
            <h3 style="margin-bottom: 20px; color: #d32f2f;">
                📜 Dettagli Attestato
            </h3>
            
            <div style="background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px;">
                    <div>
                        <strong style="color: #666;">Nome:</strong>
                        <div style="font-size: 18px; margin-top: 5px;">${attestato.nome}</div>
                    </div>
                    <div>
                        <strong style="color: #666;">Cognome:</strong>
                        <div style="font-size: 18px; margin-top: 5px;">${attestato.cognome}</div>
                    </div>
                    <div style="grid-column: span 2;">
                        <strong style="color: #666;">Codice Fiscale:</strong>
                        <div style="font-size: 16px; margin-top: 5px; font-family: monospace;">${attestato.codice_fiscale}</div>
                    </div>
                </div>
                
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                
                <div style="margin-bottom: 15px;">
                    <strong style="color: #666;">Evento:</strong>
                    <div style="font-size: 16px; margin-top: 5px;">${attestato.nome_evento}</div>
                </div>
                
                ${attestato.descrizione_evento ? `
                    <div style="margin-bottom: 15px;">
                        <strong style="color: #666;">Descrizione:</strong>
                        <div style="font-size: 14px; margin-top: 5px; line-height: 1.6;">${attestato.descrizione_evento}</div>
                    </div>
                ` : ''}
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 20px;">
                    <div>
                        <strong style="color: #666;">Data Conferimento:</strong>
                        <div style="font-size: 14px; margin-top: 5px;">${attestato.data_conferimento || 'N/A'}</div>
                    </div>
                    <div>
                        <strong style="color: #666;">Data Generazione:</strong>
                        <div style="font-size: 14px; margin-top: 5px;">${dataFormattata}</div>
                    </div>
                </div>
                
                ${attestato.url_drive ? `
                    <div style="margin-top: 25px; padding: 15px; background: #e8f5e9; border-radius: 8px;">
                        <strong style="color: #388e3c;">📁 File su Google Drive:</strong>
                        <div style="margin-top: 10px;">
                            <a href="${attestato.url_drive}" 
                               target="_blank" 
                               style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: linear-gradient(135deg, #4285f4, #34a853); color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">
                                📄 Apri su Google Drive
                            </a>
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
                <button onclick="chiudiModal()" class="btn-secondary" style="padding: 12px 30px;">
                    ✖️ Chiudi
                </button>
            </div>
        </div>
    `;
    
    mostraModal(dettagliHtml);
}

// Elimina attestato (solo admin)
async function eliminaAttestato(id, nome, cognome, nomeEvento) {
    console.log(`🗑️ Richiesta eliminazione attestato ID: ${id}`);
    
    // Verifica ruolo admin
    const ruolo = sessionStorage.getItem('ruolo');
    if (ruolo !== 'admin') {
        alert('⛔ Accesso negato! Solo gli amministratori possono eliminare gli attestati.');
        return;
    }
    
    // Conferma eliminazione
    const conferma = confirm(
        `⚠️ ATTENZIONE!\n\n` +
        `Sei sicuro di voler eliminare l'attestato di:\n` +
        `${nome} ${cognome}\n` +
        `Evento: ${nomeEvento}\n\n` +
        `Questa azione eliminerà:\n` +
        `✓ Record dal database\n` +
        `✓ File da Google Drive\n\n` +
        `NON può essere annullata!`
    );
    
    if (!conferma) {
        console.log('❌ Eliminazione annullata dall\'utente');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/elimina-attestato`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: id })
        });
        
        if (!response.ok) {
            throw new Error('Errore durante l\'eliminazione');
        }
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ Attestato di ${nome} ${cognome} eliminato con successo!`);
            // Ricarica il registro
            caricaRegistroAttestati();
        } else {
            throw new Error(data.message || 'Errore sconosciuto');
        }
        
    } catch (error) {
        console.error('❌ Errore eliminazione attestato:', error);
        alert(`❌ Errore durante l'eliminazione:\n${error.message}`);
    }
}

function mostraModal(contenuto) {
    const modal = document.createElement('div');
    modal.id = 'modalDettagli';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.6);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        overflow-y: auto;
    `;
    
    const contenitore = document.createElement('div');
    contenitore.style.cssText = `
        background: #f5f5f5;
        padding: 30px;
        border-radius: 15px;
        max-width: 800px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
    `;
    
    contenitore.innerHTML = contenuto;
    modal.appendChild(contenitore);
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            chiudiModal();
        }
    });
}

function chiudiModal() {
    const modal = document.getElementById('modalDettagli');
    if (modal) {
        modal.remove();
    }
}

function logout() {
    if (confirm('Sei sicuro di voler uscire?')) {
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
}
