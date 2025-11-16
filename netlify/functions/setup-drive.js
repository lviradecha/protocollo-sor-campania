// Script per creare cartella principale Drive
// Esegui una volta sola per setup iniziale

const { google } = require('googleapis');

async function setupDriveFolder() {
  try {
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

    // Crea cartella principale
    const folderMetadata = {
      name: 'Protocolli SOR Campania',
      mimeType: 'application/vnd.google-apps.folder'
    };

    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id, name, webViewLink'
    });

    console.log('✅ Cartella creata!');
    console.log('   Nome:', folder.data.name);
    console.log('   ID:', folder.data.id);
    console.log('   Link:', folder.data.webViewLink);
    console.log('');
    console.log('👉 Usa questo ID come DRIVE_FOLDER_ID:');
    console.log('   ' + folder.data.id);

    return folder.data.id;
  } catch (error) {
    console.error('❌ Errore:', error.message);
    throw error;
  }
}

exports.handler = async (event, context) => {
  try {
    const folderId = await setupDriveFolder();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        folderId: folderId,
        message: 'Cartella creata! Aggiorna DRIVE_FOLDER_ID su Netlify con questo ID.'
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};
