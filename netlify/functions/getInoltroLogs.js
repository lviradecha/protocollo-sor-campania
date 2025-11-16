const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

exports.handler = async (event) => {
  try {
    const limit = event.queryStringParameters?.limit || 50;
    
    const result = await pool.query(`
      SELECT l.*, r.nome_regola
      FROM log_inoltri_email l
      LEFT JOIN regole_inoltro_email r ON l.regola_id = r.id
      ORDER BY l.inoltrato_il DESC
      LIMIT $1
    `, [limit]);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result.rows)
    };
  } catch (error) {
    console.error('Errore recupero log:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
