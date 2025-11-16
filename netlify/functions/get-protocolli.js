// ====================================
// GET PROTOCOLLI CON URL DRIVE
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
    const anno = queryParams.anno || new Date().getFullYear();

    console.log(`📋 Richiesta protocolli per anno: ${anno}`);

    client = await getDbClient();

    // Query con JOIN per ottenere anche l'URL del documento Drive
    const query = `
      SELECT 
        p.*,
        d.url_documento as drive_url,
        d.nome_file_protocollato,
        d.dimensione_kb
      FROM protocolli p
      LEFT JOIN (
        SELECT DISTINCT ON (protocollo_id) 
          protocollo_id, 
          url_documento,
          nome_file_protocollato,
          dimensione_kb
        FROM documenti
        ORDER BY protocollo_id, id DESC
      ) d ON p.id = d.protocollo_id
      WHERE p.anno = $1
      ORDER BY p.data_protocollo DESC, p.numero_progressivo DESC
    `;

    const result = await client.query(query, [anno]);

    console.log(`✅ Trovati ${result.rows.length} protocolli`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        protocolli: result.rows,
        count: result.rows.length,
        anno: anno
      })
    };

  } catch (error) {
    console.error('❌ Errore get-protocolli:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Errore durante il recupero dei protocolli',
        message: error.message
      })
    };
  } finally {
    if (client) {
      await client.end();
    }
  }
};
