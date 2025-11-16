# 🔴 PROTOCOLLO SOR CAMPANIA - Sistema Serverless

Sistema di protocollazione automatica per CRI Sala Operativa Regionale Campania.

## 📦 CONTENUTO PROGETTO

```
protocollo-sor-campania/
├── public/                    # Frontend (HTML+CSS+JS puro)
│   ├── index.html            # Pagina protocollazione PDF
│   ├── registro.html         # Pagina registro protocolli
│   ├── style.css             # Stili
│   ├── app.js                # Logica protocollazione
│   └── registro.js           # Logica registro
│
├── netlify/
│   └── functions/            # Backend Serverless
│       ├── protocolla-pdf.js
│       ├── monitora-gmail.js
│       ├── registro-protocolli.js
│       └── package.json
│
├── database/
│   └── schema.sql            # Schema PostgreSQL
│
├── netlify.toml              # Configurazione Netlify
├── .env.example              # Template variabili ambiente
└── .gitignore
```

## 🚀 DEPLOY SU NETLIFY

### 1. Carica su GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TUO_USERNAME/protocollo-sor-campania.git
git push -u origin main
```

### 2. Collega a Netlify

1. Vai su [app.netlify.com](https://app.netlify.com)
2. **Add new site** → **Import from Git**
3. Seleziona il repository
4. Settings:
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
5. **NON FARE DEPLOY ANCORA!**

### 3. Setup Database Neon

1. Vai su [neon.tech](https://neon.tech)
2. Crea progetto: "protocollo-sor"
3. SQL Editor → Incolla contenuto di `database/schema.sql`
4. Esegui → Database creato!
5. Copia la **connection string**

### 4. Setup Gmail API

1. [Google Cloud Console](https://console.cloud.google.com)
2. Crea progetto: "Protocollo SOR"
3. Abilita **Gmail API**
4. Crea **OAuth credentials**
5. Usa [OAuth Playground](https://developers.google.com/oauthplayground/) per ottenere **refresh token**

### 5. Configura Variabili Ambiente su Netlify

Nel dashboard Netlify → Site configuration → Environment variables:

```
DATABASE_URL = [connection string Neon]
GMAIL_CLIENT_ID = [da Google Cloud]
GMAIL_CLIENT_SECRET = [da Google Cloud]
GMAIL_REFRESH_TOKEN = [da OAuth Playground]
GMAIL_EMAIL = sor.campania@cri.it
APP_URL = https://[tuo-sito].netlify.app
NODE_ENV = production
JWT_SECRET = [genera random: openssl rand -hex 32]
TZ = Europe/Rome
```

### 6. Deploy!

Click **Trigger deploy** su Netlify → ✅ Sito online in 2 minuti!

### 7. Configura Cron (Email Automatiche)

Netlify → Functions → `monitora-gmail` → Add trigger:
- Type: Scheduled
- Cron: `*/10 * * * *` (ogni 10 minuti)

### 8. Crea Label Gmail

In Gmail (sor.campania@cri.it):
- Crea label: `DA_PROTOCOLLARE`
- Crea label: `PROTOCOLLATO`

## ✅ TEST

1. Apri `https://[tuo-sito].netlify.app`
2. Carica PDF di test
3. Protocolla
4. Scarica PDF con intestazione!

## 📊 FUNZIONALITÀ

✅ Protocollazione PDF manuale (tipo U/I)  
✅ Protocollazione email automatica (tipo E)  
✅ Intestazione automatica su PDF  
✅ Numerazione progressiva: `-ANNO-NNNNTipo`  
✅ Registro completo con statistiche  
✅ Database PostgreSQL professionale  
✅ 100% serverless e gratuito (free tier)  

## 💰 COSTI

- **Netlify Free**: 100GB bandwidth, 125k functions/mese
- **Neon Free**: 512MB storage, 100 ore compute/mese
- **Gmail API**: Gratuito

**TOTALE: €0/mese** 🎉

## 📞 SUPPORTO

**Email**: sor.campania@cri.it  
**Tel**: +39 081 7810011 (selezione 2)

---

**CROCE ROSSA ITALIANA**  
**Sala Operativa Regionale Campania**

Versione 1.0 - Ottobre 2025
