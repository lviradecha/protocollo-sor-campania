// ====================================
// REGISTRO PROTOCOLLI - SOR CAMPANIA
// Con supporto Google Drive ed Elimina (admin)
// ====================================

const API_BASE = '/.netlify/functions';
let protocolliCache = [];

// Carica registro al caricamento della pagina
document.addEventListener('DOMContentLoaded', function() {
    console.log('📋 Pagina Registro caricata');
    caricaRegistro();
    
    // Event listener per filtri
    document.getElementById('filtroAnno').addEventListener('change', applicaFiltri);
    document.getElementById('filtroTipo').addEventListener('change', applicaFiltri);
    document.getElementById('filtroRicerca').addEventListener('input', applicaFiltri);
});

// Funzione principale per caricare il registro
async function caricaRegistro() {
    console.log('🔄 Caricamento registro...');
    
    const loadingSection = document.getElementById('loadingSection');
    const tableSection = document.getElementById('tableSection');
    const emptySection = document.getElementById('emptySection');
    const statsSection = document.getElementById('statsSection');
    
    // Mostra loading
    loadingSection.style.display = 'block';
    tableSection.style.display = 'none';
    emptySection.style.display = 'none';
    statsSection.style.display = 'none';
    
    try {
        const anno = document.getElementById('filtroAnno').value || new Date().getFullYear();
        
        const response = await fetch(`${API_BASE}/get-protocolli?anno=${anno}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`✅ Caricati ${data.protocolli?.length || 0} protocolli`);
        
        protocolliCache = data.protocolli || [];
        
        if (protocolliCache.length === 0) {
            loadingSection.style.display = 'none';
            emptySection.style.display = 'block';
            return;
        }
        
        // Mostra statistiche
        mostraStatistiche(protocolliCache, anno);
        
        // Applica filtri e mostra tabella
        applicaFiltri();
        
    } catch (error) {
        console.error('❌ Errore caricamento registro:', error);
        loadingSection.style.display = 'none';
        emptySection.style.display = 'block';
        alert('Errore durante il caricamento del registro. Riprova.');
    }
}

// Mostra statistiche
function mostraStatistiche(protocolli, anno) {
    const statsSection = document.getElementById('statsSection');
    const statsAnno = document.getElementById('statsAnno');
    const statsGrid = document.getElementById('statsGrid');
    
    const stats = {
        totale: protocolli.length,
        entrata: protocolli.filter(p => p.tipo_protocollo === 'E').length,
        uscita: protocolli.filter(p => p.tipo_protocollo === 'U').length,
        interno: protocolli.filter(p => p.tipo_protocollo === 'I').length
    };
    
    statsAnno.textContent = anno;
    
    statsGrid.innerHTML = `
        <div style="background: white; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #d32f2f;">
            <div style="font-size: 28px; font-weight: bold; color: #d32f2f;">${stats.totale}</div>
            <div style="color: #666; font-size: 13px; margin-top: 5px;">📊 Totale</div>
        </div>
        <div style="background: white; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #1976d2;">
            <div style="font-size: 28px; font-weight: bold; color: #1976d2;">${stats.entrata}</div>
            <div style="color: #666; font-size: 13px; margin-top: 5px;">📥 Entrata</div>
        </div>
        <div style="background: white; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #388e3c;">
            <div style="font-size: 28px; font-weight: bold; color: #388e3c;">${stats.uscita}</div>
            <div style="color: #666; font-size: 13px; margin-top: 5px;">📤 Uscita</div>
        </div>
        <div style="background: white; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #f57c00;">
            <div style="font-size: 28px; font-weight: bold; color: #f57c00;">${stats.interno}</div>
            <div style="color: #666; font-size: 13px; margin-top: 5px;">🔄 Interno</div>
        </div>
    `;
    
    statsSection.style.display = 'block';
}

// Applica filtri
function applicaFiltri() {
    const tipo = document.getElementById('filtroTipo').value;
    const ricerca = document.getElementById('filtroRicerca').value.toLowerCase();
    
    let protocolli = [...protocolliCache];
    
    // Filtra per tipo
    if (tipo) {
        protocolli = protocolli.filter(p => p.tipo_protocollo === tipo);
    }
    
    // Filtra per ricerca
    if (ricerca) {
        protocolli = protocolli.filter(p => {
            return (
                p.numero_protocollo?.toLowerCase().includes(ricerca) ||
                p.oggetto?.toLowerCase().includes(ricerca) ||
                p.mittente_destinatario?.toLowerCase().includes(ricerca) ||
                p.categoria?.toLowerCase().includes(ricerca)
            );
        });
    }
    
    // Mostra risultati
    mostraTabella(protocolli);
}

// Mostra tabella protocolli
function mostraTabella(protocolli) {
    const tableSection = document.getElementById('tableSection');
    const emptySection = document.getElementById('emptySection');
    const loadingSection = document.getElementById('loadingSection');
    const tableBody = document.getElementById('tableBody');
    
    loadingSection.style.display = 'none';
    
    if (protocolli.length === 0) {
        tableSection.style.display = 'none';
        emptySection.style.display = 'block';
        return;
    }
    
    emptySection.style.display = 'none';
    tableSection.style.display = 'block';
    
    // Ordina per data decrescente
    protocolli.sort((a, b) => new Date(b.data_protocollo) - new Date(a.data_protocollo));
    
    tableBody.innerHTML = protocolli.map(p => {
        const data = new Date(p.data_protocollo);
        const dataFormattata = data.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const tipoIcon = {
            'E': '📥',
            'U': '📤',
            'I': '🔄'
        }[p.tipo_protocollo] || '📄';
        
        const tipoColor = {
            'E': '#1976d2',
            'U': '#388e3c',
            'I': '#f57c00'
        }[p.tipo_protocollo] || '#666';
        
        const tipoLabel = {
            'E': 'E',
            'U': 'U',
            'I': 'I'
        }[p.tipo_protocollo] || p.tipo_protocollo;
        
        // 🆕 COLONNA DOCUMENTI CON PULSANTE DRIVE (icona)
        let documentoHtml = '<span class="no-document">–</span>';
        
        if (p.drive_url) {
            documentoHtml = `
                <a href="${p.drive_url}" 
                   target="_blank" 
                   class="btn-icon btn-icon-drive" 
                   title="Apri su Google Drive"
                   onclick="event.stopPropagation()">📄</a>
            `;
        } else if (p.url_documento) {
            documentoHtml = `
                <a href="${p.url_documento}" 
                   target="_blank" 
                   class="btn-icon btn-icon-drive" 
                   title="Apri su Google Drive"
                   onclick="event.stopPropagation()">📄</a>
            `;
        }
        
        // 🆕 COLONNA AZIONI CON ICONE COMPATTE
        const ruolo = sessionStorage.getItem('ruolo');
        const isAdmin = ruolo === 'admin';
        
        let azioniHtml = `
            <button onclick="event.stopPropagation(); vediDettagli(${p.id})" 
                    class="btn-icon btn-icon-vedi" 
                    title="Vedi dettagli">👁️</button>
        `;
        
        if (isAdmin) {
            azioniHtml += `
                <button onclick="event.stopPropagation(); sostituisciDocumento(${p.id}, '${p.numero_protocollo}')" 
                        class="btn-icon btn-icon-sostituisci"
                        title="Sostituisci documento">🔄</button>
                <button onclick="event.stopPropagation(); eliminaProtocollo(${p.id}, '${p.numero_protocollo}')" 
                        class="btn-icon btn-icon-elimina"
                        title="Elimina protocollo">🗑️</button>
            `;
        }
        
        return `
            <tr style="cursor: pointer;" onclick="vediDettagli(${p.id})">
                <td title="${p.numero_protocollo}">${p.numero_protocollo}</td>
                <td title="${dataFormattata}">${dataFormattata}</td>
                <td style="text-align: center;">
                    <span style="background: ${tipoColor}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px;">
                        ${tipoIcon} ${tipoLabel}
                    </span>
                </td>
                <td title="${p.categoria || 'N/A'}">${p.categoria || 'N/A'}</td>
                <td title="${p.mittente_destinatario || 'N/A'}" class="oggetto-cell">${p.mittente_destinatario || 'N/A'}</td>
                <td title="${p.oggetto || 'N/A'}" class="oggetto-cell">${p.oggetto || 'N/A'}</td>
                <td style="text-align: center;">${documentoHtml}</td>
                <td style="text-align: center;">${azioniHtml}</td>
            </tr>
        `;
    }).join('');
    
    // Aggiungi tooltip alle celle
    setTimeout(addTooltipsToTable, 100);
}

// Vedi dettagli protocollo
async function vediDettagli(id) {
    console.log(`📄 Apertura dettagli protocollo ID: ${id}`);
    
    try {
        const response = await fetch(`${API_BASE}/get-protocollo?id=${id}`);
        
        if (!response.ok) {
            throw new Error('Errore nel caricamento dei dettagli');
        }
        
        const data = await response.json();
        const p = data.protocollo;
        
        const dataFormattata = new Date(p.data_protocollo).toLocaleString('it-IT');
        
        const tipoLabel = {
            'E': '📥 Entrata',
            'U': '📤 Uscita',
            'I': '🔄 Interno'
        }[p.tipo_protocollo] || p.tipo_protocollo;
        
        let documentiHtml = '<p style="color: #999; font-style: italic;">Nessun documento allegato</p>';
        
        if (data.documenti && data.documenti.length > 0) {
            documentiHtml = data.documenti.map(doc => `
                <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>📄 ${doc.nome_file_protocollato || doc.nome_file_originale}</strong>
                            <div style="font-size: 12px; color: #666; margin-top: 4px;">
                                ${doc.dimensione_kb ? `${doc.dimensione_kb} KB` : 'Dimensione non disponibile'}
                            </div>
                        </div>
                        ${doc.url_documento ? `
                            <a href="${doc.url_documento}" 
                               target="_blank" 
                               class="btn-drive" 
                               style="padding: 8px 16px;">
                                <span class="drive-icon">📄</span>
                                <span>Apri su Drive</span>
                            </a>
                        ` : ''}
                    </div>
                </div>
            `).join('');
        }
        
        const dettagliHtml = `
            <div style="max-width: 800px; margin: 0 auto;">
                <h3 style="margin-bottom: 20px; color: #d32f2f;">
                    📋 Dettagli Protocollo ${p.numero_protocollo}
                </h3>
                
                <div style="background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px;">
                        <div>
                            <strong style="color: #666;">N° Protocollo:</strong>
                            <div style="font-size: 18px; margin-top: 5px;">${p.numero_protocollo}</div>
                        </div>
                        <div>
                            <strong style="color: #666;">Data/Ora:</strong>
                            <div style="font-size: 18px; margin-top: 5px;">${dataFormattata}</div>
                        </div>
                        <div>
                            <strong style="color: #666;">Tipo:</strong>
                            <div style="font-size: 18px; margin-top: 5px;">${tipoLabel}</div>
                        </div>
                        <div>
                            <strong style="color: #666;">Categoria:</strong>
                            <div style="font-size: 18px; margin-top: 5px;">${p.categoria || 'N/A'}</div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <strong style="color: #666;">Mittente/Destinatario:</strong>
                        <div style="font-size: 16px; margin-top: 5px;">${p.mittente_destinatario || 'N/A'}</div>
                    </div>
                    
                    <div style="margin-bottom: 25px;">
                        <strong style="color: #666;">Oggetto:</strong>
                        <div style="font-size: 16px; margin-top: 5px; line-height: 1.5;">${p.oggetto || 'N/A'}</div>
                    </div>
                    
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;">
                    
                    <div>
                        <strong style="color: #666; font-size: 16px;">📎 Documenti Allegati:</strong>
                        <div style="margin-top: 15px;">
                            ${documentiHtml}
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 25px;">
                    <button onclick="chiudiModal()" class="btn-secondary" style="padding: 12px 30px;">
                        ✖️ Chiudi
                    </button>
                </div>
            </div>
        `;
        
        mostraModal(dettagliHtml);
        
    } catch (error) {
        console.error('❌ Errore caricamento dettagli:', error);
        alert('Errore durante il caricamento dei dettagli. Riprova.');
    }
}

// 🆕 FUNZIONE ELIMINA PROTOCOLLO (solo admin)
async function eliminaProtocollo(id, numeroProtocollo) {
    console.log(`🗑️ Richiesta eliminazione protocollo ${numeroProtocollo} (ID: ${id})`);
    
    // Verifica ruolo admin
    const ruolo = sessionStorage.getItem('ruolo');
    if (ruolo !== 'admin') {
        alert('⛔ Accesso negato! Solo gli amministratori possono eliminare i protocolli.');
        return;
    }
    
    // Conferma eliminazione
    const conferma = confirm(
        `⚠️ ATTENZIONE!\n\n` +
        `Sei sicuro di voler eliminare il protocollo:\n` +
        `${numeroProtocollo}\n\n` +
        `Questa azione NON può essere annullata!\n` +
        `Anche i documenti su Google Drive potrebbero essere eliminati.`
    );
    
    if (!conferma) {
        console.log('❌ Eliminazione annullata dall\'utente');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/elimina-protocollo`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: id,
                numeroProtocollo: numeroProtocollo
            })
        });
        
        if (!response.ok) {
            throw new Error('Errore durante l\'eliminazione');
        }
        
        const data = await response.json();
        
        if (data.success) {
            alert(`✅ Protocollo ${numeroProtocollo} eliminato con successo!`);
            // Ricarica il registro
            caricaRegistro();
        } else {
            throw new Error(data.message || 'Errore sconosciuto');
        }
        
    } catch (error) {
        console.error('❌ Errore eliminazione protocollo:', error);
        alert(`❌ Errore durante l'eliminazione del protocollo:\n${error.message}`);
    }
}

// Mostra modal
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
        max-width: 900px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
    `;
    
    contenitore.innerHTML = contenuto;
    modal.appendChild(contenitore);
    document.body.appendChild(modal);
    
    // Chiudi con click esterno
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            chiudiModal();
        }
    });
}

// Chiudi modal
function chiudiModal() {
    const modal = document.getElementById('modalDettagli');
    if (modal) {
        modal.remove();
    }
}

// Aggiungi tooltip alle celle
function addTooltipsToTable() {
    const cells = document.querySelectorAll('#protocolliTable td');
    cells.forEach(cell => {
        if (cell.scrollWidth > cell.clientWidth) {
            cell.title = cell.textContent;
            cell.style.cursor = 'help';
        }
    });
}

// Funzione di logout
function logout() {
    if (confirm('Sei sicuro di voler uscire?')) {
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
}

// ====================================
// FUNZIONI SOSTITUZIONE DOCUMENTO
// ====================================

/**
 * Apre modal per sostituire un documento protocollato
 */
async function sostituisciDocumento(protocolloId, numeroProtocollo) {
    console.log(`🔄 Apertura modal sostituzione per protocollo: ${numeroProtocollo}`);
    
    const modalHtml = `
        <div style="max-width: 600px; margin: 0 auto;">
            <h3 style="margin-bottom: 20px; color: #d32f2f;">
                🔄 Sostituisci Documento
            </h3>
            
            <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin-bottom: 20px; border-radius: 5px;">
                <strong>⚠️ Attenzione:</strong>
                <p style="margin: 10px 0 0 0;">
                    Stai per sostituire il documento del protocollo <strong>${numeroProtocollo}</strong>.<br>
                    Il numero di protocollo rimarrà invariato, verrà sostituito solo il file PDF.
                </p>
            </div>
            
            <div style="background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div class="form-group">
                    <label for="nuovoPdf"><strong>📄 Seleziona nuovo PDF:</strong></label>
                    <input type="file" 
                           id="nuovoPdf" 
                           accept=".pdf"
                           style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 5px; margin-top: 5px;">
                    <small style="color: #666; display: block; margin-top: 5px;">
                        Il nuovo PDF sostituirà quello attuale mantenendo lo stesso numero di protocollo
                    </small>
                </div>
                
                <div class="form-group" style="margin-top: 20px;">
                    <label for="motivoSostituzione"><strong>📝 Motivo sostituzione:</strong></label>
                    <textarea id="motivoSostituzione" 
                              rows="3"
                              placeholder="Es: Correzione dati, aggiornamento informazioni..."
                              style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 5px; margin-top: 5px; resize: vertical;"></textarea>
                    <small style="color: #666; display: block; margin-top: 5px;">
                        Inserisci il motivo della sostituzione per la tracciabilità
                    </small>
                </div>
                
                <div id="uploadProgress" style="display: none; margin-top: 20px;">
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; text-align: center;">
                        <p style="margin: 0; color: #1976d2; font-weight: 600;">⏳ Sostituzione in corso...</p>
                        <progress style="width: 100%; margin-top: 10px;" max="100"></progress>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 25px;">
                <button onclick="confermasostituzione(${protocolloId}, '${numeroProtocollo}')" 
                        class="btn-primary" 
                        style="padding: 12px 30px;">
                    ✅ Conferma Sostituzione
                </button>
                <button onclick="chiudiModalSostituzione()" 
                        class="btn-secondary" 
                        style="padding: 12px 30px; background: #999;">
                    ❌ Annulla
                </button>
            </div>
        </div>
    `;
    
    mostraModalSostituzione(modalHtml);
}

/**
 * Conferma e esegue la sostituzione del documento
 */
async function confermasostituzione(protocolloId, numeroProtocollo) {
    const fileInput = document.getElementById('nuovoPdf');
    const motivoInput = document.getElementById('motivoSostituzione');
    const progressDiv = document.getElementById('uploadProgress');
    
    // Validazione
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('❌ Seleziona un file PDF');
        return;
    }
    
    const file = fileInput.files[0];
    
    if (file.type !== 'application/pdf') {
        alert('❌ Il file deve essere in formato PDF');
        return;
    }
    
    const motivo = motivoInput.value.trim();
    if (!motivo) {
        alert('❌ Inserisci il motivo della sostituzione');
        return;
    }
    
    // Conferma finale
    const conferma = confirm(
        `⚠️ CONFERMA SOSTITUZIONE\n\n` +
        `Protocollo: ${numeroProtocollo}\n` +
        `Nuovo file: ${file.name}\n` +
        `Motivo: ${motivo}\n\n` +
        `Il vecchio file verrà salvato come backup.\n` +
        `Confermi la sostituzione?`
    );
    
    if (!conferma) {
        console.log('❌ Sostituzione annullata');
        return;
    }
    
    try {
        progressDiv.style.display = 'block';
        console.log('🔄 Inizio sostituzione documento...');
        
        // Converti PDF in base64
        const pdfBase64 = await fileToBase64(file);
        
        // Chiamata API
        const response = await fetch('/.netlify/functions/sostituisci-documento', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                protocolloId: protocolloId,
                pdfBase64: pdfBase64,
                motivoSostituzione: motivo,
                utenteEmail: sessionStorage.getItem('username') || 'utente'
            })
        });
        
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Documento sostituito con successo');
            
            // Chiudi modal
            chiudiModalSostituzione();
            
            // Mostra successo
            alert(
                `✅ SOSTITUZIONE COMPLETATA!\n\n` +
                `Protocollo: ${data.numeroProtocollo}\n` +
                `File: ${data.nomeFile}\n` +
                `Backup: ${data.fileBackup}\n\n` +
                `Il registro verrà aggiornato automaticamente.`
            );
            
            // Ricarica registro
            caricaRegistro();
            
            // Opzionale: scarica il nuovo PDF
            const confermaDownload = confirm('Vuoi scaricare il nuovo documento protocollato?');
            if (confermaDownload && data.pdfBase64) {
                scaricaPdf(data.pdfBase64, data.nomeFile);
            }
        } else {
            throw new Error(data.message || 'Errore sconosciuto');
        }
        
    } catch (error) {
        console.error('❌ Errore sostituzione:', error);
        progressDiv.style.display = 'none';
        alert(`❌ Errore durante la sostituzione:\n${error.message}`);
    }
}

/**
 * Converte file in base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Scarica PDF da base64
 */
function scaricaPdf(base64, nomeFile) {
    const linkSource = `data:application/pdf;base64,${base64}`;
    const downloadLink = document.createElement('a');
    downloadLink.href = linkSource;
    downloadLink.download = nomeFile;
    downloadLink.click();
}

/**
 * Mostra modal sostituzione
 */
function mostraModalSostituzione(contenuto) {
    const modal = document.createElement('div');
    modal.id = 'modalSostituzione';
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
            chiudiModalSostituzione();
        }
    });
}

/**
 * Chiudi modal sostituzione
 */
function chiudiModalSostituzione() {
    const modal = document.getElementById('modalSostituzione');
    if (modal) {
        modal.remove();
    }
}
