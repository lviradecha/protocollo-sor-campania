// netlify/functions/toggle-utente.js
const { Client } = require('pg');

async function getDbClient() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
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
    const { userId, azione, adminUsername } = JSON.parse(event.body);

    if (!userId || !azione || !adminUsername) {
      await client.end();
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Dati mancanti' })
      };
    }

    // Verifica che chi esegue sia admin
    const adminCheck = await client.query(
      'SELECT ruolo FROM utenti WHERE username = $1 AND attivo = true',
      [adminUsername]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].ruolo !== 'admin') {
      await client.end();
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Permesso negato' })
      };
    }

    // Non può disattivare se stesso
    const userCheck = await client.query(
      'SELECT username FROM utenti WHERE id = $1',
      [userId]
    );

    if (userCheck.rows[0].username === adminUsername) {
      await client.end();
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Non puoi disattivare il tuo stesso account' })
      };
    }

    // Attiva/Disattiva utente
    const nuovoStato = azione === 'attiva';
    
    const result = await client.query(
      `UPDATE utenti 
       SET attivo = $1
       WHERE id = $2
       RETURNING username, nome, cognome, attivo`,
      [nuovoStato, userId]
    );

    if (result.rows.length === 0) {
      await client.end();
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Utente non trovato' })
      };
    }

    const utente = result.rows[0];

    // Log azione
    await client.query(
      `INSERT INTO audit_log (user_id, username, nome_completo, azione, dettagli)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        utente.username,
        `${utente.nome} ${utente.cognome}`,
        nuovoStato ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        JSON.stringify({ by: adminUsername })
      ]
    );

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Utente ${nuovoStato ? 'attivato' : 'disattivato'} con successo`,
        utente: {
          username: utente.username,
          attivo: utente.attivo
        }
      })
    };

  } catch (error) {
    console.error('Errore toggle utente:', error);
    await client.end();
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Errore durante l\'operazione',
        message: error.message
      })
    };
  }
};
