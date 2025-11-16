# 🎓 Sistema Attestati con Google Drive Integration

## ✅ Cosa è stato implementato

### 📋 Funzionalità principali:

1. **Generazione Attestati PDF**
   - Template professionale con intestazione CRI
   - QR Code per verifica
   - Generazione batch da file CSV

2. **Caricamento Automatico su Google Drive**
   - Ogni attestato viene caricato su Drive
   - Cartella creata automaticamente per ogni evento
   - Struttura: `Attestati SOR Campania / Nome_Evento / attestato.pdf`

3. **Database Completo**
   - Registrazione di ogni attestato generato
   - Link Drive salvati per accesso rapido
   - Ricerca per nome, cognome, CF, evento

4. **Registro Attestati**
   - Visualizzazione di tutti gli attestati generati
   - Filtri per evento e ricerca testuale
   - Link diretti a Google Drive
   - Statistiche aggregate

---

## 📁 File da caricare

### 1. Frontend (root del progetto):
- ✅ `attestati.js` - JavaScript aggiornato con info Drive
- ✅ `registro-attestati.html` - Nuova pagina registro attestati
- ✅ `registro-attestati.js` - JavaScript per registro

### 2. Backend (cartella `/netlify/functions/`):
- ✅ `genera-attestati-drive.js` - Generazione + Upload Drive (rinomina in `genera-attestati.js`)
- ✅ `get-attestati.js` - API per recuperare attestati

### 3. Database:
- ✅ `create-table-attestati.sql` - Esegui questo script su PostgreSQL

---

## 🔧 Configurazione

### 1. Variabili d'ambiente Netlify:

Assicurati di avere queste variabili già configurate:
```
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
DRIVE_FOLDER_ID=... (cartella principale Drive)
DATABASE_URL=...
```

### 2. Opzionale - Cartella dedicata attestati:

Se vuoi una cartella separata per gli attestati:
```
DRIVE_ATTESTATI_FOLDER_ID=... (ID cartella specifica per attestati)
```

Se non specificata, userà `DRIVE_FOLDER_ID`

### 3. Crea tabella database:

Esegui `create-table-attestati.sql` sul tuo database PostgreSQL

---

## 🎯 Come funziona

### Flusso di generazione:

1. **Utente carica CSV** con partecipanti (Nome, Cognome, CF)
2. **Sistema genera PDF** per ogni partecipante
3. **Crea cartella Drive** con nome evento (es: "EXE_HIRPUS_2025")
4. **Carica ogni PDF** nella cartella Drive
5. **Salva nel database**:
   - Dati partecipante
   - Info evento
   - **URL Google Drive** per ogni attestato
6. **Restituisce ZIP** per download locale
7. **Mostra conferma** con info cartella Drive

### Struttura Drive:

```
📁 Attestati SOR Campania (DRIVE_ATTESTATI_FOLDER_ID o DRIVE_FOLDER_ID)
   └── 📁 EXE_HIRPUS_2025
       ├── 📄 Attestato_ROSSI_MARIO_RSSMRA80A01F839X.pdf
       ├── 📄 Attestato_BIANCHI_LUIGI_BNCLGU85M15H501Y.pdf
       └── 📄 ...
   └── 📁 EXE_VESUVIO_2025
       ├── 📄 ...
```

---

## 📊 Registro Attestati

Nuova pagina: `registro-attestati.html`

### Funzionalità:

- 📋 Lista completa attestati generati
- 🔍 Filtro per evento
- 🔎 Ricerca per nome/cognome/CF
- 📊 Statistiche:
  - Totale attestati
  - Numero eventi
  - Attestati ultimi 7 giorni
- 📄 Link diretti a Google Drive per ogni attestato
- 👁️ Dettagli attestato con tutte le info

### Accesso:

Nuovo link nel menu di navigazione:
```html
<a href="registro-attestati.html" class="nav-link">📊 Registro Attestati</a>
```

---

## 🔐 Sicurezza

- ✅ Autenticazione OAuth2 per Google Drive
- ✅ Nomi file sanitizzati (caratteri speciali rimossi)
- ✅ Transazioni database con rollback in caso di errore
- ✅ Gestione errori completa
- ✅ Log dettagliati per debugging

---

## 📦 Dipendenze NPM

Assicurati che `package.json` includa:

```json
{
  "dependencies": {
    "pdf-lib": "^1.17.1",
    "qrcode": "^1.5.3",
    "googleapis": "^118.0.0",
    "pg": "^8.11.0",
    "adm-zip": "^0.5.10"
  }
}
```

---

## 🎨 Miglioramenti futuri suggeriti:

1. **Template personalizzabili** - Diversi template per tipi di evento
2. **Invio email automatico** - Invia attestato via email al partecipante
3. **Firma digitale** - Firma elettronica qualificata
4. **Bulk download** - Download multiplo da registro
5. **Statistiche avanzate** - Dashboard con grafici
6. **Export Excel** - Esporta registro in Excel
7. **Eliminazione attestati** - Solo per admin con conferma
8. **Modifica retroattiva** - Rigenerazione attestato corretto

---

## 🐛 Troubleshooting

### Gli attestati non vengono caricati su Drive:

1. Verifica le variabili d'ambiente
2. Controlla i permessi OAuth (serve `https://www.googleapis.com/auth/drive.file`)
3. Verifica che `DRIVE_FOLDER_ID` sia corretto

### Errore database:

1. Esegui `create-table-attestati.sql`
2. Verifica `DATABASE_URL`
3. Controlla i log Netlify Functions

### File ZIP vuoto:

1. Controlla console browser per errori
2. Verifica formato CSV (3 colonne, no intestazione)
3. Controlla log backend

---

## 📞 Supporto

Per problemi o domande:
- Email: sor.campania@cri.it
- Tel: +39 081 7810011 (selezione 2)

---

**Versione:** 2.0  
**Ultimo aggiornamento:** Gennaio 2025  
**Sviluppato per:** CRI Comitato Regionale Campania - SOR
