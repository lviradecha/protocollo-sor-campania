// netlify/functions/crea-utente.js
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function getDbClient() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
}

// Genera password casuale
function generaPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Invia email con credenziali usando SendGrid
async function inviaEmailCredenziali(email, nome, cognome, username, password) {
  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: email,
      from: {
        email: 'sor.campania@cri.it',
        name: 'SOR Campania - CRI'
      },
      subject: '🔐 Credenziali Accesso Sistema Protocollo SOR Campania',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .credentials { background: white; padding: 20px; border-left: 4px solid #d32f2f; margin: 20px 0; }
            .credentials strong { color: #d32f2f; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .btn { display: inline-block; padding: 12px 30px; background: #d32f2f; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔴 CROCE ROSSA ITALIANA</h1>
              <p>Sala Operativa Regionale - Campania</p>
            </div>
            <div class="content">
              <h2>Benvenuto/a ${nome} ${cognome}!</h2>
              <p>È stato creato un account per te nel Sistema di Protocollazione SOR Campania.</p>
              
              <div class="credentials">
                <h3>📋 Le tue credenziali di accesso:</h3>
                <p><strong>Username:</strong> ${username}</p>
                <p><strong>Password:</strong> ${password}</p>
                <p><strong>Link:</strong> <a href="https://protocollo-sor-campania.netlify.app/login.html">Accedi al sistema</a></p>
              </div>
              
              <p><strong>⚠️ Importante:</strong></p>
              <ul>
                <li>Conserva queste credenziali in modo sicuro</li>
                <li>Al primo accesso ti verrà chiesto di cambiare la password</li>
                <li>Non condividere le tue credenziali con nessuno</li>
              </ul>
              
              <a href="https://protocollo-sor-campania.netlify.app/login.html" class="btn">Accedi Ora</a>
              
              <div class="footer">
                <p>📞 Per supporto: sor.campania@cri.it | +39 081 7810011 (selezione 2)</p>
                <p>© 2025 Croce Rossa Italiana - Comitato Regionale Campania</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await sgMail.send(msg);
    console.log('✅ Email inviata tramite SendGrid');
    return true;
  } catch (error) {
    console.error('❌ Errore invio email SendGrid:', error);
    if (error.response) {
      console.error('Dettagli:', error.response.body);
    }
    return false;
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Metodo non permesso' })
    };
  }

  const client = await getDbClient();

  try {
    const { nome, cognome, email, username, ruolo, adminUsername } = JSON.parse(event.body);

    // Verifica che chi crea sia admin
    const adminCheck = await client.query(
      'SELECT ruolo FROM utenti WHERE username = $1 AND attivo = true',
      [adminUsername]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].ruolo !== 'admin') {
      await client.end();
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Permesso negato. Solo gli admin possono creare utenti.' })
      };
    }

    // Verifica che username non esista già
    const usernameCheck = await client.query(
      'SELECT id FROM utenti WHERE username = $1',
      [username.toLowerCase()]
    );

    if (usernameCheck.rows.length > 0) {
      await client.end();
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Username già esistente' })
      };
    }

    // Genera password casuale
    const password = generaPassword();
    const passwordHash = await bcrypt.hash(password, 10);

    // Inserisci utente
    const result = await client.query(
      `INSERT INTO utenti (username, password_hash, nome, cognome, email, ruolo, primo_accesso, attivo)
       VALUES ($1, $2, $3, $4, $5, $6, true, true)
       RETURNING id, username, nome, cognome, email, ruolo`,
      [username.toLowerCase(), passwordHash, nome, cognome, email, ruolo || 'operatore']
    );

    const nuovoUtente = result.rows[0];

    // Log creazione
    await client.query(
      `INSERT INTO audit_log (user_id, username, nome_completo, azione, dettagli)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        nuovoUtente.id,
        nuovoUtente.username,
        `${nuovoUtente.nome} ${nuovoUtente.cognome}`,
        'USER_CREATED',
        JSON.stringify({ createdBy: adminUsername, ruolo: nuovoUtente.ruolo })
      ]
    );

    await client.end();

    // Invia email con credenziali
    const emailInviata = await inviaEmailCredenziali(
      email,
      nome,
      cognome,
      username,
      password
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Utente creato con successo',
        user: {
          id: nuovoUtente.id,
          username: nuovoUtente.username,
          nome: nuovoUtente.nome,
          cognome: nuovoUtente.cognome,
          email: nuovoUtente.email,
          ruolo: nuovoUtente.ruolo
        },
        password: password, // Ritorna password per mostrarla all'admin
        emailInviata: emailInviata
      })
    };

  } catch (error) {
    console.error('Errore creazione utente:', error);
    await client.end();
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Errore durante la creazione dell\'utente',
        message: error.message
      })
    };
  }
};
