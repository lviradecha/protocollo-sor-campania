// ====================================
// EXPORT ATTESTATI CSV
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

// Funzione per escape CSV
function escapeCsv(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
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

  const header = columns.map(col => escapeCsv(col.label)).join(',');
  
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
    const evento = params.evento || 'tutti'; // nome evento specifico o 'tutti'
    const emailStatus = params.email_status || 'tutti'; // tutti, inviata, non_inviata, no_email

    console.log(`📊 Export attestati: evento=${evento}, email_status=${emailStatus}`);

    client = await getDbClient();

    // Query base
    let query = `
      SELECT 
        id,
        nome,
        cognome,
        codice_fiscale,
        nome_evento,
        tipo_evento,
        descrizione_evento,
        data_conferimento,
        nome_file,
        url_drive,
        email_destinatario,
        CASE 
          WHEN email_destinatario IS NULL OR email_destinatario = '' THEN 'N/A'
          WHEN email_inviata = true THEN 'Inviata'
          ELSE 'Non inviata'
        END as stato_email,
        TO_CHAR(data_generazione, 'DD/MM/YYYY HH24:MI') as data_generazione
      FROM attestati
      WHERE 1=1
    `;

    const queryParams = [];
    let paramIndex = 1;

    // Filtro per evento
    if (evento !== 'tutti') {
      query += ` AND nome_evento = $${paramIndex}`;
      queryParams.push(evento);
      paramIndex++;
    }

    // Filtro per stato email
    if (emailStatus === 'inviata') {
      query += ` AND email_inviata = true`;
    } else if (emailStatus === 'non_inviata') {
      query += ` AND email_inviata = false AND email_destinatario IS NOT NULL AND email_destinatario != ''`;
    } else if (emailStatus === 'no_email') {
      query += ` AND (email_destinatario IS NULL OR email_destinatario = '')`;
    }

    query += ` ORDER BY data_generazione DESC, cognome ASC, nome ASC`;

    const result = await client.query(query, queryParams);

    console.log(`✅ Trovati ${result.rows.length} attestati`);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Nessun attestato trovato per i criteri selezionati'
        })
      };
    }

    // Definisci colonne CSV
    const columns = [
      { key: 'nome', label: 'Nome' },
      { key: 'cognome', label: 'Cognome' },
      { key: 'codice_fiscale', label: 'Codice Fiscale' },
      { key: 'nome_evento', label: 'Nome Evento' },
      { key: 'tipo_evento', label: 'Tipo Evento' },
      { key: 'descrizione_evento', label: 'Descrizione Evento' },
      { key: 'data_conferimento', label: 'Data Conferimento' },
      { key: 'nome_file', label: 'Nome File' },
      { key: 'url_drive', label: 'URL Google Drive' },
      { key: 'email_destinatario', label: 'Email Destinatario' },
      { key: 'stato_email', label: 'Stato Email' },
      { key: 'data_generazione', label: 'Data Generazione' }
    ];

    // Genera CSV
    const csvContent = convertToCSV(result.rows, columns);

    // Nome file
    const eventoLabel = evento === 'tutti' ? 'Tutti_Eventi' : evento.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `Attestati_${eventoLabel}_${timestamp}.csv`;

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
    console.error('❌ Errore export CSV attestati:', error);
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
