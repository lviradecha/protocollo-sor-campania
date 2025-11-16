// app.js - Logica protocollazione PDF

let selectedFile = null;

document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('pdfFile');
    const uploadBox = document.getElementById('uploadBox');
    const uploadText = document.getElementById('uploadText');
    const form = document.getElementById('protocolloForm');
    
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            selectedFile = file;
            uploadText.innerHTML = `✅ File selezionato:<br><strong>${file.name}</strong><br>(${(file.size / 1024).toFixed(2)} KB)`;
            hideError();
        } else {
            showError('Carica solo file PDF');
            selectedFile = null;
        }
    });
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        protocollaDocumento();
    });
});

async function protocollaDocumento() {
    const oggetto = document.getElementById('oggetto').value.trim();
    const tipoProtocollo = document.getElementById('tipoProtocollo').value;
    const destinatari = document.getElementById('destinatari').value.trim();
    const btnProtocolla = document.getElementById('btnProtocolla');
    
    if (!selectedFile) {
        showError('Carica un file PDF');
        return;
    }
    
    if (!oggetto) {
        showError('Inserisci l\'oggetto del documento');
        return;
    }
    
    btnProtocolla.disabled = true;
    btnProtocolla.textContent = '⏳ Protocollazione in corso...';
    hideError();
    hideResult();
    
    try {
        const base64 = await fileToBase64(selectedFile);
        
        const response = await fetch('/.netlify/functions/protocolla-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                pdfBase64: base64,
                tipoProtocollo: tipoProtocollo,
                oggetto: oggetto,
                destinatari: destinatari || 'N/A'
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Errore durante la protocollazione');
        }
        
        showResult(data);
        
        // Nome file: usa quello dal server o genera uno di default
        const nomeFile = data.nomeFile || `Protocollo_${data.numeroProtocollo.replace(/\//g, '_')}.pdf`;
        downloadPDF(data.pdfBase64, nomeFile);
        
        resetForm();
        
    } catch (error) {
        console.error('Errore:', error);
        showError(error.message || 'Errore durante la protocollazione');
    } finally {
        btnProtocolla.disabled = false;
        btnProtocolla.textContent = '🔴 Protocolla Documento';
    }
}

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

function downloadPDF(base64, nomeFile) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeFile; // Nome file completo dal server
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showResult(data) {
    const resultSection = document.getElementById('resultSection');
    const nomeFileDisplay = data.nomeFile || 'Protocollo.pdf';
    
    resultSection.innerHTML = `
        <h3>✅ Protocollazione Completata!</h3>
        <p><strong>Numero Protocollo:</strong> ${data.numeroProtocollo}</p>
        <p><strong>Data:</strong> ${data.dataProtocollo}</p>
        <p><strong>File:</strong> ${nomeFileDisplay}</p>
        ${data.driveUrl ? `<p><strong>📁 <a href="${data.driveUrl}" target="_blank">Visualizza su Drive</a></strong></p>` : ''}
        <p style="font-size: 14px; margin-top: 10px; opacity: 0.9;">
            Il PDF protocollato è stato scaricato automaticamente
        </p>
    `;
    resultSection.style.display = 'block';
    
    setTimeout(() => {
        resultSection.style.display = 'none';
    }, 10000);
}

function showError(message) {
    const errorSection = document.getElementById('errorSection');
    errorSection.innerHTML = `<p>❌ ${message}</p>`;
    errorSection.style.display = 'block';
}

function hideError() {
    const errorSection = document.getElementById('errorSection');
    errorSection.style.display = 'none';
}

function hideResult() {
    const resultSection = document.getElementById('resultSection');
    resultSection.style.display = 'none';
}

function resetForm() {
    document.getElementById('protocolloForm').reset();
    document.getElementById('uploadText').innerHTML = '📄 Clicca per selezionare PDF';
    selectedFile = null;
}
