// ====================================
// EXPORT CSV - FRONTEND INTEGRATION
// ====================================

// Funzione per export protocolli CSV
async function exportProtocolliCSV() {
  try {
    // Mostra loading
    const exportBtn = document.getElementById('exportProtocolliBtn');
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generazione CSV...';
    exportBtn.disabled = true;

    // Prendi filtri correnti dalla pagina
    const annoSelect = document.getElementById('filtroAnno');
    const tipoSelect = document.getElementById('filtroTipo');
    
    const anno = annoSelect ? annoSelect.value : new Date().getFullYear();
    const tipo = tipoSelect && tipoSelect.value !== '' ? tipoSelect.value : 'tutti';

    // Costruisci URL con parametri
    const params = new URLSearchParams({
      anno: anno,
      tipo: tipo,
      formato: 'csv'
    });

    const url = `/.netlify/functions/export-protocolli-csv?${params.toString()}`;

    console.log('📥 Download CSV da:', url);

    // Fetch
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Errore durante l\'export');
    }

    // Leggi il CSV
    const csvContent = await response.text();

    // Crea blob e download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    // Estrai nome file dall'header Content-Disposition se presente
    const contentDisposition = response.headers.get('Content-Disposition');
    let fileName = `Protocolli_${anno}_${tipo}_${new Date().toISOString().split('T')[0]}.csv`;
    
    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
      if (fileNameMatch) {
        fileName = fileNameMatch[1];
      }
    }

    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('✅ CSV scaricato:', fileName);

    // Mostra success
    showToast('CSV scaricato con successo!', 'success');

  } catch (error) {
    console.error('❌ Errore export CSV:', error);
    showToast('Errore durante l\'export CSV: ' + error.message, 'error');
  } finally {
    // Ripristina pulsante
    const exportBtn = document.getElementById('exportProtocolliBtn');
    if (exportBtn) {
      exportBtn.innerHTML = originalText;
      exportBtn.disabled = false;
    }
  }
}

// Funzione per export attestati CSV
async function exportAttestatiCSV() {
  try {
    // Mostra loading
    const exportBtn = document.getElementById('exportAttestatiBtn');
    const originalText = exportBtn.innerHTML;
    exportBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generazione CSV...';
    exportBtn.disabled = true;

    // Prendi filtri correnti dalla pagina
    const eventoSelect = document.getElementById('filtroEvento');
    const emailStatusSelect = document.getElementById('filtroEmailStatus');
    
    const evento = eventoSelect && eventoSelect.value !== '' ? eventoSelect.value : 'tutti';
    const emailStatus = emailStatusSelect && emailStatusSelect.value !== '' ? emailStatusSelect.value : 'tutti';

    // Costruisci URL con parametri
    const params = new URLSearchParams({
      evento: evento,
      email_status: emailStatus
    });

    const url = `/.netlify/functions/export-attestati-csv?${params.toString()}`;

    console.log('📥 Download CSV da:', url);

    // Fetch
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Errore durante l\'export');
    }

    // Leggi il CSV
    const csvContent = await response.text();

    // Crea blob e download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    // Estrai nome file
    const contentDisposition = response.headers.get('Content-Disposition');
    let fileName = `Attestati_${new Date().toISOString().split('T')[0]}.csv`;
    
    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
      if (fileNameMatch) {
        fileName = fileNameMatch[1];
      }
    }

    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('✅ CSV scaricato:', fileName);

    // Mostra success
    showToast('CSV scaricato con successo!', 'success');

  } catch (error) {
    console.error('❌ Errore export CSV:', error);
    showToast('Errore durante l\'export CSV: ' + error.message, 'error');
  } finally {
    // Ripristina pulsante
    const exportBtn = document.getElementById('exportAttestatiBtn');
    if (exportBtn) {
      exportBtn.innerHTML = originalText;
      exportBtn.disabled = false;
    }
  }
}

// Funzione toast helper (se non esiste già)
function showToast(message, type = 'info') {
  // Usa bootstrap toast se disponibile, altrimenti alert
  if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
    // Crea toast container se non esiste
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toastContainer';
      toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      document.body.appendChild(toastContainer);
    }

    // Crea toast
    const toastId = 'toast_' + Date.now();
    const bgClass = type === 'success' ? 'bg-success' : (type === 'error' ? 'bg-danger' : 'bg-info');
    
    const toastHTML = `
      <div id="${toastId}" class="toast ${bgClass} text-white" role="alert">
        <div class="toast-body">
          ${message}
        </div>
      </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
    toast.show();

    // Rimuovi dopo che scompare
    toastElement.addEventListener('hidden.bs.toast', () => {
      toastElement.remove();
    });

  } else {
    // Fallback ad alert
    alert(message);
  }
}

// Export per uso globale
if (typeof window !== 'undefined') {
  window.exportProtocolliCSV = exportProtocolliCSV;
  window.exportAttestatiCSV = exportAttestatiCSV;
}
