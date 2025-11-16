// ====================================
// DASHBOARD - SOR CAMPANIA
// ====================================

const API_BASE = '/.netlify/functions';
let chartsInstances = {};

document.addEventListener('DOMContentLoaded', function() {
    console.log('📊 Dashboard caricata');
    caricaDashboard();
});

async function caricaDashboard() {
    mostraLoading(true);
    
    try {
        // Carica dati in parallelo
        const [protocolli, attestati] = await Promise.all([
            fetch(`${API_BASE}/get-dashboard-stats`).then(r => r.json()),
            fetch(`${API_BASE}/get-attestati`).then(r => r.json())
        ]);
        
        console.log('✅ Dati caricati:', {
            protocolli: protocolli.stats,
            attestati: attestati.count
        });
        
        // Genera statistiche
        generaStatCards(protocolli.stats, attestati);
        
        // Genera grafici
        generaGrafici(protocolli.stats, attestati.attestati);
        
        // Genera attività recenti
        generaAttivitaRecenti(protocolli.recenti, attestati.attestati);
        
        mostraLoading(false);
        
    } catch (error) {
        console.error('❌ Errore caricamento dashboard:', error);
        mostraLoading(false);
        alert('Errore durante il caricamento della dashboard');
    }
}

function generaStatCards(statsProtocolli, statsAttestati) {
    const container = document.getElementById('statsCards');
    
    const cards = [
        {
            icon: '📋',
            label: 'Protocolli Totali',
            value: statsProtocolli.totale || 0,
            change: statsProtocolli.variazione || 0,
            color: '#d32f2f',
            bgColor: '#ffebee'
        },
        {
            icon: '📥',
            label: 'Protocolli Entrata',
            value: statsProtocolli.entrata || 0,
            change: null,
            color: '#1976d2',
            bgColor: '#e3f2fd'
        },
        {
            icon: '📤',
            label: 'Protocolli Uscita',
            value: statsProtocolli.uscita || 0,
            change: null,
            color: '#388e3c',
            bgColor: '#e8f5e9'
        },
        {
            icon: '🔄',
            label: 'Protocolli Interni',
            value: statsProtocolli.interno || 0,
            change: null,
            color: '#f57c00',
            bgColor: '#fff3e0'
        },
        {
            icon: '📜',
            label: 'Attestati Generati',
            value: statsAttestati.count || 0,
            change: null,
            color: '#7b1fa2',
            bgColor: '#f3e5f5'
        },
        {
            icon: '📅',
            label: 'Ultimi 7 Giorni',
            value: statsProtocolli.ultimi7gg || 0,
            change: null,
            color: '#0097a7',
            bgColor: '#e0f7fa'
        }
    ];
    
    container.innerHTML = cards.map(card => `
        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-icon" style="background: ${card.bgColor};">
                    ${card.icon}
                </div>
                <div class="stat-label">${card.label}</div>
            </div>
            <div class="stat-value" style="color: ${card.color};">${card.value}</div>
            ${card.change !== null ? `
                <div class="stat-change ${card.change >= 0 ? 'positive' : 'negative'}">
                    ${card.change >= 0 ? '↑' : '↓'} ${Math.abs(card.change)}% vs mese scorso
                </div>
            ` : ''}
        </div>
    `).join('');
    
    container.style.display = 'grid';
}

function generaGrafici(statsProtocolli, attestati) {
    const section = document.getElementById('chartsSection');
    section.style.display = 'block';
    
    // Grafico 1: Protocolli per Mese
    generaGraficoProtocolliMese(statsProtocolli);
    
    // Grafico 2: Protocolli per Tipo
    generaGraficoProtocolliTipo(statsProtocolli);
    
    // Grafico 3: Attestati per Evento
    generaGraficoAttestatiEvento(attestati);
    
    // Grafico 4: Trend Settimanale
    generaGraficoTrendSettimanale(statsProtocolli);
}

function generaGraficoProtocolliMese(stats) {
    const ctx = document.getElementById('chartProtocolliMese');
    
    if (chartsInstances.protocolliMese) {
        chartsInstances.protocolliMese.destroy();
    }
    
    const mesi = stats.perMese || [];
    
    chartsInstances.protocolliMese = new Chart(ctx, {
        type: 'line',
        data: {
            labels: mesi.map(m => m.mese),
            datasets: [{
                label: 'Protocolli',
                data: mesi.map(m => m.count),
                borderColor: '#d32f2f',
                backgroundColor: 'rgba(211, 47, 47, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

function generaGraficoProtocolliTipo(stats) {
    const ctx = document.getElementById('chartProtocolliTipo');
    
    if (chartsInstances.protocolliTipo) {
        chartsInstances.protocolliTipo.destroy();
    }
    
    chartsInstances.protocolliTipo = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Entrata', 'Uscita', 'Interno'],
            datasets: [{
                data: [stats.entrata || 0, stats.uscita || 0, stats.interno || 0],
                backgroundColor: ['#1976d2', '#388e3c', '#f57c00'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function generaGraficoAttestatiEvento(attestati) {
    const ctx = document.getElementById('chartAttestatiEvento');
    
    if (chartsInstances.attestatiEvento) {
        chartsInstances.attestatiEvento.destroy();
    }
    
    // Raggruppa attestati per evento
    const eventiMap = {};
    attestati.forEach(a => {
        const evento = a.nome_evento || 'N/A';
        eventiMap[evento] = (eventiMap[evento] || 0) + 1;
    });
    
    const eventiData = Object.entries(eventiMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10 eventi
    
    chartsInstances.attestatiEvento = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: eventiData.map(e => e[0].substring(0, 30)),
            datasets: [{
                label: 'Attestati',
                data: eventiData.map(e => e[1]),
                backgroundColor: '#7b1fa2',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

function generaGraficoTrendSettimanale(stats) {
    const ctx = document.getElementById('chartTrendSettimanale');
    
    if (chartsInstances.trendSettimanale) {
        chartsInstances.trendSettimanale.destroy();
    }
    
    const ultimi7gg = stats.ultimi7Giorni || [];
    
    chartsInstances.trendSettimanale = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ultimi7gg.map(g => g.giorno),
            datasets: [{
                label: 'Protocolli',
                data: ultimi7gg.map(g => g.count),
                backgroundColor: '#0097a7',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

function generaAttivitaRecenti(protocolliRecenti, attestatiRecenti) {
    const section = document.getElementById('activitySection');
    const list = document.getElementById('activityList');
    
    const attivita = [];
    
    // Aggiungi protocolli recenti
    if (protocolliRecenti && protocolliRecenti.length > 0) {
        protocolliRecenti.slice(0, 5).forEach(p => {
            attivita.push({
                icon: p.tipo_protocollo === 'E' ? '📥' : p.tipo_protocollo === 'U' ? '📤' : '🔄',
                title: `Protocollo ${p.numero_protocollo}`,
                description: p.oggetto ? p.oggetto.substring(0, 60) + '...' : 'N/A',
                time: formatTimeAgo(new Date(p.data_protocollo)),
                type: 'protocollo'
            });
        });
    }
    
    // Aggiungi attestati recenti
    if (attestatiRecenti && attestatiRecenti.length > 0) {
        attestatiRecenti.slice(0, 5).forEach(a => {
            attivita.push({
                icon: '📜',
                title: `Attestato ${a.nome} ${a.cognome}`,
                description: a.nome_evento ? a.nome_evento.substring(0, 60) : 'N/A',
                time: formatTimeAgo(new Date(a.data_generazione)),
                type: 'attestato'
            });
        });
    }
    
    // Ordina per data
    attivita.sort((a, b) => b.time - a.time);
    
    list.innerHTML = attivita.slice(0, 10).map(att => `
        <div class="activity-item">
            <div class="activity-icon">${att.icon}</div>
            <div class="activity-content">
                <div class="activity-title">${att.title}</div>
                <div class="activity-time">${att.time}</div>
            </div>
        </div>
    `).join('');
    
    section.style.display = 'block';
}

function formatTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Adesso';
    if (minutes < 60) return `${minutes} minuti fa`;
    if (hours < 24) return `${hours} ore fa`;
    if (days < 7) return `${days} giorni fa`;
    return date.toLocaleDateString('it-IT');
}

function mostraLoading(show) {
    document.getElementById('loadingDashboard').style.display = show ? 'block' : 'none';
    document.getElementById('statsCards').style.display = show ? 'none' : 'grid';
    document.getElementById('chartsSection').style.display = show ? 'none' : 'block';
    document.getElementById('activitySection').style.display = show ? 'none' : 'block';
}

function aggiornadashboard() {
    caricaDashboard();
}

function logout() {
    if (confirm('Sei sicuro di voler uscire?')) {
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
}
