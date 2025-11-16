// netlify/functions/elimina-utente-anonimizza.js
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
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Metodo non permesso' })
    };
  }

  const client = await getDbClient();

  try {
    const { userId, adminUsername } = JSON.parse(event.body);

    if (!userId || !adminUsername) {
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

    // Ottieni info utente
    const userCheck = await client.query(
      'SELECT username, nome, cognome FROM utenti WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      await client.end();
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Utente non trovato' })
      };
    }

    const utenteDaEliminare = userCheck.rows[0];

    // Non può eliminare se stesso
    if (utenteDaEliminare.username === adminUsername) {
      await client.end();
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Non puoi eliminare il tuo stesso account' })
      };
    }

    await client.query('BEGIN');

    // Anonimizza utente invece di eliminarlo
    const timestamp = Date.now();
    await client.query(
      `UPDATE utenti 
       SET 
         username = $1,
         email = $2,
         nome = 'ELIMINATO',
         cognome = 'ELIMINATO',
         attivo = false,
         password_hash = 'DELETED'
       WHERE id = $3`,
      [
        `deleted_${timestamp}`,
        `deleted_${timestamp}@deleted.local`,
        userId
      ]
    );

    // Log eliminazione
    await client.query(
      `INSERT INTO audit_log (user_id, username, nome_completo, azione, dettagli)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        utenteDaEliminare.username,
        `${utenteDaEliminare.nome} ${utenteDaEliminare.cognome}`,
        'USER_DELETED',
        JSON.stringify({ by: adminUsername, anonymized: true })
      ]
    );

    await client.query('COMMIT');
    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Utente ${utenteDaEliminare.username} eliminato (anonimizzato)`,
        username: utenteDaEliminare.username
      })
    };

  } catch (error) {
    console.error('Errore eliminazione utente:', error);
    await client.query('ROLLBACK');
    await client.end();
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Errore durante l\'eliminazione',
        message: error.message
      })
    };
  }
};
