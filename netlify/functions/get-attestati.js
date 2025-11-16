// ====================================
// GET ATTESTATI
// ====================================

const { Client } = require('pg');

async function getDbClient() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  let client;

  try {
    const queryParams = event.queryStringParameters || {};
    const evento = queryParams.evento;
    const codiceFiscale = queryParams.cf;

    console.log('📊 Richiesta attestati');

    client = await getDbClient();

    let query = 'SELECT * FROM attestati WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (evento) {
      query += ` AND nome_evento = $${paramCount}`;
      params.push(evento);
      paramCount++;
    }

    if (codiceFiscale) {
      query += ` AND codice_fiscale = $${paramCount}`;
      params.push(codiceFiscale.toUpperCase());
      paramCount++;
    }

    query += ' ORDER BY data_generazione DESC';

    const result = await client.query(query, params);

    console.log(`✅ Trovati ${result.rows.length} attestati`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        attestati: result.rows,
        count: result.rows.length
      })
    };

  } catch (error) {
    console.error('❌ Errore get-attestati:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Errore durante il recupero degli attestati',
        message: error.message
      })
    };
  } finally {
    if (client) {
      await client.end();
    }
  }
};
