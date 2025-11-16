// ====================================
// GET PROTOCOLLO SINGOLO CON DOCUMENTI
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
    const id = queryParams.id;

    if (!id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'ID protocollo obbligatorio' })
      };
    }

    console.log(`📄 Richiesta dettagli protocollo ID: ${id}`);

    client = await getDbClient();

    // Query protocollo
    const protocolloResult = await client.query(
      'SELECT * FROM protocolli WHERE id = $1',
      [id]
    );

    if (protocolloResult.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Protocollo non trovato' })
      };
    }

    // Query documenti allegati
    const documentiResult = await client.query(
      `SELECT 
        id,
        nome_file_originale,
        nome_file_protocollato,
        url_documento,
        dimensione_kb,
        mime_type
      FROM documenti 
      WHERE protocollo_id = $1 
      ORDER BY id DESC`,
      [id]
    );

    console.log(`✅ Protocollo trovato con ${documentiResult.rows.length} documenti`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        protocollo: protocolloResult.rows[0],
        documenti: documentiResult.rows
      })
    };

  } catch (error) {
    console.error('❌ Errore get-protocollo:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Errore durante il recupero del protocollo',
        message: error.message
      })
    };
  } finally {
    if (client) {
      await client.end();
    }
  }
};
