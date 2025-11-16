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

  try {
    const params = event.queryStringParameters || {};
    const anno = params.anno || new Date().getFullYear().toString();
    const tipo = params.tipo || '';
    const ricerca = params.ricerca || '';

    const client = await getDbClient();

    try {
      // Query per i protocolli
      let query = `
        SELECT 
          p.id,
          p.numero_protocollo,
          p.anno,
          p.numero_progressivo,
          p.tipo_protocollo,
          p.oggetto,
          p.mittente_destinatario,
          p.categoria,
          p.data_protocollo,
          p.created_at,
          COUNT(d.id) as num_documenti
        FROM protocolli p
        LEFT JOIN documenti d ON p.id = d.protocollo_id
        WHERE 1=1
      `;

      const queryParams = [];
      let paramIndex = 1;

      // Filtro anno
      if (anno) {
        query += ` AND p.anno = $${paramIndex}`;
        queryParams.push(parseInt(anno));
        paramIndex++;
      }

      // Filtro tipo
      if (tipo) {
        query += ` AND p.tipo_protocollo = $${paramIndex}`;
        queryParams.push(tipo);
        paramIndex++;
      }

      // Filtro ricerca
      if (ricerca) {
        query += ` AND (
          p.numero_protocollo ILIKE $${paramIndex} OR
          p.oggetto ILIKE $${paramIndex} OR
          p.mittente_destinatario ILIKE $${paramIndex}
        )`;
        queryParams.push(`%${ricerca}%`);
        paramIndex++;
      }

      query += `
        GROUP BY p.id
        ORDER BY p.numero_progressivo DESC, p.created_at DESC
        LIMIT 500
      `;

      const result = await client.query(query, queryParams);

      // Statistiche
      const statsQuery = `
        SELECT 
          tipo_protocollo,
          COUNT(*) as totale
        FROM protocolli
        WHERE anno = $1
        GROUP BY tipo_protocollo
      `;
      const statsResult = await client.query(statsQuery, [parseInt(anno)]);

      const stats = {
        totale: 0,
        entrata: 0,
        uscita: 0,
        interno: 0
      };

      statsResult.rows.forEach(row => {
        const count = parseInt(row.totale);
        stats.totale += count;
        if (row.tipo_protocollo === 'E') stats.entrata = count;
        if (row.tipo_protocollo === 'U') stats.uscita = count;
        if (row.tipo_protocollo === 'I') stats.interno = count;
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          protocolli: result.rows,
          stats: stats,
          filtri: {
            anno: anno,
            tipo: tipo,
            ricerca: ricerca
          }
        })
      };

    } finally {
      await client.end();
    }

  } catch (error) {
    console.error('Errore caricamento registro:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Errore durante il caricamento del registro',
        message: error.message
      })
    };
  }
};
