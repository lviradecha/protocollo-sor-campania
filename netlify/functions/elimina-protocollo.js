// ====================================
// ELIMINA PROTOCOLLO (SOLO ADMIN)
// ====================================

const { Client } = require('pg');
const { google } = require('googleapis');

async function getDbClient() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
}

// Funzione per eliminare file da Google Drive
async function deleteFileFromDrive(fileUrl) {
  try {
    // Estrai l'ID del file dall'URL di Drive
    // URL formato: https://drive.google.com/file/d/FILE_ID/view
    const fileIdMatch = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!fileIdMatch) {
      console.log('⚠️ Impossibile estrarre ID file da URL:', fileUrl);
      return false;
    }
    
    const fileId = fileIdMatch[1];
    console.log(`📂 ID file Drive da eliminare: ${fileId}`);
    
    // Configurazione OAuth2
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Elimina il file da Drive
    await drive.files.delete({
      fileId: fileId
    });
    
    console.log(`✅ File eliminato da Google Drive: ${fileId}`);
    return true;
    
  } catch (error) {
    console.error('❌ Errore eliminazione file da Drive:', error.message);
    // Non bloccare l'eliminazione del protocollo se fallisce l'eliminazione da Drive
    return false;
  }
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  let client;

  try {
    const body = JSON.parse(event.body);
    const { id, numeroProtocollo } = body;

    if (!id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'ID protocollo obbligatorio' })
      };
    }

    console.log(`🗑️ Richiesta eliminazione protocollo ID: ${id} (${numeroProtocollo})`);

    client = await getDbClient();

    // Verifica che il protocollo esista
    const checkResult = await client.query(
      'SELECT id, numero_protocollo FROM protocolli WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Protocollo non trovato' 
        })
      };
    }

    // Inizia transazione
    await client.query('BEGIN');

    try {
      // 0. Recupera gli URL dei documenti da Drive PRIMA di eliminarli dal DB
      const documentiResult = await client.query(
        'SELECT url_documento FROM documenti WHERE protocollo_id = $1 AND url_documento IS NOT NULL',
        [id]
      );
      
      const driveUrls = documentiResult.rows.map(row => row.url_documento);
      console.log(`📂 Trovati ${driveUrls.length} file su Drive da eliminare`);
      
      // Elimina i file da Google Drive (prima della transazione DB)
      for (const url of driveUrls) {
        await deleteFileFromDrive(url);
      }

      // *** IMPORTANTE: Elimina prima le dipendenze (foreign keys) ***
      
      // 1. Elimina dalla tabella email_processate (FOREIGN KEY!)
      const deleteEmailProcessate = await client.query(
        'DELETE FROM email_processate WHERE protocollo_id = $1',
        [id]
      );
      console.log(`✅ Eliminati ${deleteEmailProcessate.rowCount} record da email_processate`);

      // 2. Elimina i log di attività collegati al protocollo
      const deleteLog = await client.query(
        'DELETE FROM log_attivita WHERE protocollo_id = $1',
        [id]
      );
      console.log(`✅ Eliminati ${deleteLog.rowCount} log di attività`);

      // 3. Elimina i documenti collegati
      const deleteDocumenti = await client.query(
        'DELETE FROM documenti WHERE protocollo_id = $1',
        [id]
      );
      console.log(`✅ Eliminati ${deleteDocumenti.rowCount} documenti dal database`);

      // 4. Ora possiamo eliminare il protocollo in sicurezza
      const deleteProtocollo = await client.query(
        'DELETE FROM protocolli WHERE id = $1',
        [id]
      );
      console.log(`✅ Protocollo ${numeroProtocollo} eliminato`);

      // 5. Log attività dell'eliminazione (senza protocollo_id)
      await client.query(
        `INSERT INTO log_attivita (tipo_evento, descrizione, metadata) 
         VALUES ($1, $2, $3)`,
        [
          'PROTOCOLLO_ELIMINATO',
          `Protocollo ${numeroProtocollo} eliminato (inclusi ${driveUrls.length} file da Drive)`,
          JSON.stringify({ 
            id, 
            numeroProtocollo,
            file_drive_eliminati: driveUrls.length,
            email_processate_eliminate: deleteEmailProcessate.rowCount,
            data_eliminazione: new Date().toISOString()
          })
        ]
      );

      await client.query('COMMIT');
      console.log('✅ Transazione completata');

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: `Protocollo ${numeroProtocollo} eliminato con successo`,
          details: {
            file_drive: driveUrls.length,
            email_processate: deleteEmailProcessate.rowCount,
            documenti: deleteDocumenti.rowCount,
            log: deleteLog.rowCount
          }
        })
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Errore durante transazione:', error);
      throw error;
    }

  } catch (error) {
    console.error('❌ Errore eliminazione protocollo:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Errore durante l\'eliminazione del protocollo',
        message: error.message,
        detail: error.detail || ''
      })
    };
  } finally {
    if (client) {
      await client.end();
    }
  }
};
