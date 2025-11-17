const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event) => {
  try {
    const data = JSON.parse(event.body);
    
    const result = await pool.query(`
      INSERT INTO regole_inoltro_email 
      (nome_regola, pattern_oggetto, pattern_mittente, destinatari, destinatari_cc,
       corpo_template, inoltra_allegati, includi_testo_originale, attivo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      data.nome_regola,
      data.pattern_oggetto || null,
      data.pattern_mittente || null,
      data.destinatari,
      data.destinatari_cc || [],
      data.corpo_template,
      data.inoltra_allegati !== false,
      data.includi_testo_originale !== false,
      data.attivo !== false
    ]);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result.rows[0])
    };
  } catch (error) {
    console.error('Errore creazione regola:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
