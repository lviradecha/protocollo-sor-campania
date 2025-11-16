// attestati.js - Logica generazione attestati

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('attestatiForm');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        generaAttestati();
    });
});

async function generaAttestati() {
    const csvFile = document.getElementById('csvFile').files[0];
    const nomeEvento = document.getElementById('nomeEvento').value.trim();
    const tipoEvento = document.getElementById('tipoEvento').value.trim();
    const descrizioneEvento = document.getElementById('descrizioneEvento').value.trim();
    const dataConferimento = document.getElementById('dataConferimento').value;
    const inviaEmail = document.getElementById('inviaEmail').checked;
    const btnGenera = document.getElementById('btnGenera');
    
    if (!csvFile) {
        showError('Carica il file CSV con i partecipanti');
        return;
    }
    
    btnGenera.disabled = true;
    btnGenera.textContent = '⏳ Generazione in corso...';
    hideError();
    hideResult();
    showProgress();
    
    try {
        // Leggi CSV
        const csvText = await readFileAsText(csvFile);
        const partecipanti = parseCSV(csvText);
        
        if (partecipanti.length === 0) {
            throw new Error('Nessun partecipante trovato nel CSV');
        }
        
        updateProgress(20, `Trovati ${partecipanti.length} partecipanti...`);
        
        // Formatta data italiana
        const dataItaliana = formatDataItaliana(dataConferimento);
        
        // Invia richiesta
        const response = await fetch('/.netlify/functions/genera-attestati', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                partecipanti: partecipanti,
                nomeEvento: nomeEvento,
                tipoEvento: tipoEvento,
                descrizioneEvento: descrizioneEvento,
                dataConferimento: dataItaliana,
                inviaEmail: inviaEmail
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Errore durante la generazione');
        }
        
        updateProgress(80, 'Download ZIP in corso...');
        
        // Scarica ZIP
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Attestati_${nomeEvento.replace(/\s+/g, '_')}_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        updateProgress(100, 'Completato!');
        showResult(partecipanti.length, nomeEvento, inviaEmail);
        
        // Reset form
        document.getElementById('attestatiForm').reset();
        
    } catch (error) {
        console.error('Errore:', error);
        showError(error.message || 'Errore durante la generazione degli attestati');
    } finally {
        btnGenera.disabled = false;
        btnGenera.textContent = '📜 Genera Attestati';
        hideProgress();
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const partecipanti = [];
    
    for (const line of lines) {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 3) {
            partecipanti.push({
                nome: parts[0],
                cognome: parts[1],
                codiceFiscale: parts[2],
                email: parts[3] || '' // Email opzionale
            });
        }
    }
    
    return partecipanti;
}

function formatDataItaliana(dataISO) {
    // Da YYYY-MM-DD a DD/MM/YYYY
    const [anno, mese, giorno] = dataISO.split('-');
    return `${giorno}/${mese}/${anno}`;
}

function showProgress() {
    document.getElementById('progressSection').style.display = 'block';
}

function hideProgress() {
    document.getElementById('progressSection').style.display = 'none';
}

function updateProgress(value, text) {
    document.getElementById('progressBar').value = value;
    document.getElementById('progressText').textContent = text;
}

function showResult(count, evento, emailInviate) {
    const resultSection = document.getElementById('resultSection');
    resultSection.innerHTML = `
        <h3>✅ Attestati Generati e Caricati su Drive!</h3>
        <p><strong>${count} attestati</strong> generati per <strong>${evento}</strong></p>
        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-top: 15px;">
            <p style="margin: 0; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">📁</span>
                <span><strong>Cartella Google Drive:</strong> ${evento.replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '_')}</span>
            </p>
        </div>
        ${emailInviate ? `
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-top: 15px;">
                <p style="margin: 0; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 24px;">📧</span>
                    <span><strong>Email inviate!</strong> Ogni partecipante riceverà l'attestato via email</span>
                </p>
            </div>
        ` : ''}
        <p style="font-size: 14px; margin-top: 10px;">
            ✅ File ZIP scaricato automaticamente<br>
            ✅ Attestati caricati su Google Drive<br>
            ${emailInviate ? '✅ Email inviate ai partecipanti<br>' : ''}
            ✅ Link disponibili nel registro attestati
        </p>
    `;
    resultSection.style.display = 'block';
    
    setTimeout(() => {
        resultSection.style.display = 'none';
    }, 15000);
}

function showError(message) {
    const errorSection = document.getElementById('errorSection');
    errorSection.innerHTML = `<p>❌ ${message}</p>`;
    errorSection.style.display = 'block';
}

function hideError() {
    document.getElementById('errorSection').style.display = 'none';
}

function hideResult() {
    document.getElementById('resultSection').style.display = 'none';
}

// Scarica template CSV
function scaricaTemplateCSV() {
    const csvContent = `Mario,Rossi,RSSMRA80A01F839X,mario.rossi@example.com
Luigi,Bianchi,BNCLGU85M15H501Y,luigi.bianchi@example.com
Anna,Verdi,VRDNNA90M50H501Z,N/A`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template_partecipanti.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('✅ Template CSV scaricato');
}
