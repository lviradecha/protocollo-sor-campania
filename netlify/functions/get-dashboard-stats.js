// ====================================
// GET DASHBOARD STATISTICS
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
    console.log('📊 Richiesta statistiche dashboard');

    client = await getDbClient();
    const anno = new Date().getFullYear();

    // Statistiche generali
    const statsGenerali = await client.query(
      `SELECT 
        COUNT(*) as totale,
        COUNT(CASE WHEN tipo_protocollo = 'E' THEN 1 END) as entrata,
        COUNT(CASE WHEN tipo_protocollo = 'U' THEN 1 END) as uscita,
        COUNT(CASE WHEN tipo_protocollo = 'I' THEN 1 END) as interno,
        COUNT(CASE WHEN data_protocollo >= NOW() - INTERVAL '7 days' THEN 1 END) as ultimi7gg
       FROM protocolli 
       WHERE anno = $1`,
      [anno]
    );

    // Protocolli per mese (ultimi 6 mesi)
    const perMese = await client.query(
      `SELECT 
        TO_CHAR(data_protocollo, 'Mon') as mese,
        COUNT(*) as count
       FROM protocolli 
       WHERE data_protocollo >= NOW() - INTERVAL '6 months'
       GROUP BY TO_CHAR(data_protocollo, 'Mon'), EXTRACT(MONTH FROM data_protocollo)
       ORDER BY EXTRACT(MONTH FROM data_protocollo) DESC
       LIMIT 6`
    );

    // Ultimi 7 giorni dettagliati
    const ultimi7Giorni = await client.query(
      `SELECT 
        TO_CHAR(data_protocollo, 'DD/MM') as giorno,
        COUNT(*) as count
       FROM protocolli 
       WHERE data_protocollo >= NOW() - INTERVAL '7 days'
       GROUP BY TO_CHAR(data_protocollo, 'DD/MM'), DATE(data_protocollo)
       ORDER BY DATE(data_protocollo) DESC
       LIMIT 7`
    );

    // Protocolli recenti
    const recenti = await client.query(
      `SELECT * FROM protocolli 
       ORDER BY data_protocollo DESC 
       LIMIT 10`
    );

    // Calcola variazione percentuale (mese corrente vs mese scorso)
    const variazioneResult = await client.query(
      `SELECT 
        COUNT(CASE WHEN data_protocollo >= DATE_TRUNC('month', NOW()) THEN 1 END) as mese_corrente,
        COUNT(CASE WHEN data_protocollo >= DATE_TRUNC('month', NOW() - INTERVAL '1 month') 
                   AND data_protocollo < DATE_TRUNC('month', NOW()) THEN 1 END) as mese_scorso
       FROM protocolli 
       WHERE anno = $1`,
      [anno]
    );

    const meseCorrente = parseInt(variazioneResult.rows[0].mese_corrente) || 0;
    const meseScorso = parseInt(variazioneResult.rows[0].mese_scorso) || 1;
    const variazione = meseScorso > 0 
      ? Math.round(((meseCorrente - meseScorso) / meseScorso) * 100) 
      : 0;

    const stats = {
      ...statsGenerali.rows[0],
      variazione: variazione,
      perMese: perMese.rows.reverse(),
      ultimi7Giorni: ultimi7Giorni.rows.reverse()
    };

    console.log('✅ Statistiche generate:', stats);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        stats: stats,
        recenti: recenti.rows
      })
    };

  } catch (error) {
    console.error('❌ Errore get-dashboard-stats:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Errore durante il recupero delle statistiche',
        message: error.message
      })
    };
  } finally {
    if (client) {
      await client.end();
    }
  }
};
