// ====================================
// ELIMINA ATTESTATO (DB + DRIVE)
// Solo per admin
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

async function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

async function deleteFileFromDrive(driveFileId) {
  try {
    if (!driveFileId) {
      console.log('⚠️ Nessun file ID fornito, skip eliminazione Drive');
      return false;
    }

    const drive = await getDriveClient();
    
    await drive.files.delete({
      fileId: driveFileId
    });
    
    console.log(`✅ File eliminato da Google Drive: ${driveFileId}`);
    return true;
    
  } catch (error) {
    console.error('❌ Errore eliminazione file da Drive:', error.message);
    // Non bloccare l'eliminazione dal DB se fallisce Drive
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
    const { id } = body;

    if (!id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'ID attestato obbligatorio' })
      };
    }

    console.log(`🗑️ Richiesta eliminazione attestato ID: ${id}`);

    client = await getDbClient();

    // Recupera info attestato (per Drive file ID)
    const attestatoResult = await client.query(
      'SELECT id, nome, cognome, nome_evento, drive_file_id FROM attestati WHERE id = $1',
      [id]
    );

    if (attestatoResult.rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Attestato non trovato' 
        })
      };
    }

    const attestato = attestatoResult.rows[0];
    console.log(`📄 Attestato trovato: ${attestato.nome} ${attestato.cognome} - ${attestato.nome_evento}`);

    // Elimina file da Google Drive (se esiste)
    if (attestato.drive_file_id) {
      await deleteFileFromDrive(attestato.drive_file_id);
    } else {
      console.log('⚠️ Nessun file Drive associato');
    }

    // Elimina dal database
    const deleteResult = await client.query(
      'DELETE FROM attestati WHERE id = $1',
      [id]
    );

    console.log(`✅ Attestato eliminato dal database`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Attestato di ${attestato.nome} ${attestato.cognome} eliminato con successo`
      })
    };

  } catch (error) {
    console.error('❌ Errore eliminazione attestato:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Errore durante l\'eliminazione dell\'attestato',
        message: error.message
      })
    };
  } finally {
    if (client) {
      await client.end();
    }
  }
};
