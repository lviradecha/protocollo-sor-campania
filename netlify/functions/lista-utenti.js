// netlify/functions/lista-utenti.js
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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Metodo non permesso' })
    };
  }

  const client = await getDbClient();

  try {
    const params = event.queryStringParameters || {};
    const adminUsername = params.adminUsername;

    // Verifica che chi richiede sia admin
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

    // Carica tutti gli utenti (esclusi quelli eliminati)
    const result = await client.query(`
      SELECT 
        id,
        username,
        nome,
        cognome,
        email,
        ruolo,
        attivo,
        primo_accesso,
        data_creazione,
        data_ultimo_accesso
      FROM utenti
      WHERE username NOT LIKE 'deleted_%'
      ORDER BY data_creazione DESC
    `);

    await client.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        utenti: result.rows
      })
    };

  } catch (error) {
    console.error('Errore lista utenti:', error);
    await client.end();
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Errore durante il caricamento degli utenti',
        message: error.message
      })
    };
  }
};
