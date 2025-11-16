// ====================================
// EXPORT PROTOCOLLI CSV
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

// Funzione per escape CSV (gestisce virgole, virgolette, a capo)
function escapeCsv(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // Se contiene virgole, virgolette o a capo, wrappa in virgolette e escape virgolette interne
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  
  return stringValue;
}

// Converti array di oggetti in CSV
function convertToCSV(data, columns) {
  if (!data || data.length === 0) {
    return '';
  }

  // Header
  const header = columns.map(col => escapeCsv(col.label)).join(',');
  
  // Rows
  const rows = data.map(row => {
    return columns.map(col => {
      const value = row[col.key];
      return escapeCsv(value);
    }).join(',');
  });

  return [header, ...rows].join('\n');
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
    // Parametri query string
    const params = event.queryStringParameters || {};
    const anno = params.anno || new Date().getFullYear();
    const tipo = params.tipo || 'tutti'; // tutti, E, U, I

    console.log(`📊 Export richiesto: anno=${anno}, tipo=${tipo}, formato=csv`);

    client = await getDbClient();

    // Query con JOIN per ottenere i documenti
    let query = `
      SELECT 
        p.id,
        p.numero_protocollo,
        p.anno,
        p.numero_progressivo,
        p.tipo_protocollo,
        p.categoria,
        p.oggetto,
        p.mittente_destinatario,
        p.note,
        d.nome_file_protocollato,
        d.url_documento,
        TO_CHAR(p.data_protocollo, 'DD/MM/YYYY HH24:MI') as data_protocollo,
        TO_CHAR(p.created_at, 'DD/MM/YYYY HH24:MI') as creato_il
      FROM protocolli p
      LEFT JOIN documenti d ON p.id = d.protocollo_id
      WHERE p.anno = $1
    `;

    const queryParams = [anno];

    // Filtro per tipo
    if (tipo !== 'tutti' && tipo !== '') {
      query += ` AND p.tipo_protocollo = $2`;
      queryParams.push(tipo);
    }

    query += ` ORDER BY p.data_protocollo DESC, p.numero_protocollo DESC`;

    const result = await client.query(query, queryParams);

    console.log(`✅ Trovati ${result.rows.length} protocolli`);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Nessun protocollo trovato per i criteri selezionati'
        })
      };
    }

    // Definisci colonne CSV
    const columns = [
      { key: 'numero_protocollo', label: 'Numero Protocollo' },
      { key: 'data_protocollo', label: 'Data Protocollo' },
      { key: 'tipo_protocollo', label: 'Tipo' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'mittente_destinatario', label: 'Mittente/Destinatario' },
      { key: 'oggetto', label: 'Oggetto' },
      { key: 'note', label: 'Note' },
      { key: 'nome_file_protocollato', label: 'Nome File' },
      { key: 'url_documento', label: 'URL Google Drive' },
      { key: 'creato_il', label: 'Creato Il' }
    ];

    // Genera CSV
    const csvContent = convertToCSV(result.rows, columns);

    // Nome file
    const tipoLabel = tipo === 'tutti' || tipo === '' ? 'Tutti' : tipo;
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `Protocolli_${anno}_${tipoLabel}_${timestamp}.csv`;

    console.log(`✅ CSV generato: ${fileName}`);

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache'
      },
      body: '\uFEFF' + csvContent // BOM UTF-8 per Excel
    };

  } catch (error) {
    console.error('❌ Errore export CSV:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Errore durante l\'export CSV',
        message: error.message
      })
    };
  } finally {
    if (client) {
      await client.end();
    }
  }
};
