const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event) => {
  try {
    const id = event.queryStringParameters.id;
    const data = JSON.parse(event.body);
    
    const result = await pool.query(`
      UPDATE regole_inoltro_email 
      SET nome_regola = $1,
          pattern_oggetto = $2,
          pattern_mittente = $3,
          destinatari = $4,
          destinatari_cc = $5,
          corpo_template = $6,
          inoltra_allegati = $7,
          includi_testo_originale = $8,
          attivo = $9,
          modificato_il = NOW()
      WHERE id = $10
      RETURNING *
    `, [
      data.nome_regola,
      data.pattern_oggetto || null,
      data.pattern_mittente || null,
      data.destinatari,
      data.destinatari_cc || [],
      data.corpo_template,
      data.inoltra_allegati,
      data.includi_testo_originale,
      data.attivo,
      id
    ]);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result.rows[0])
    };
  } catch (error) {
    console.error('Errore aggiornamento regola:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
