// Helper per Google Drive
const { google } = require('googleapis');

/**
 * Crea un client Google Drive autenticato
 */
function getDriveClient(oauth2Client) {
  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Ottieni o crea cartella per anno/tipo
 * Struttura: Protocolli SOR Campania/ANNO/TIPO/
 */
async function getOrCreateFolder(drive, parentFolderId, anno, tipo) {
  try {
    // Mappa tipo protocollo a nome cartella
    const tipoFolderMap = {
      'E': 'Entrata',
      'U': 'Uscita',
      'I': 'Interno'
    };
    const tipoFolder = tipoFolderMap[tipo] || tipo;

    // 1. Cerca/Crea cartella anno
    let annoFolderId = await findOrCreateFolder(drive, parentFolderId, anno.toString());
    
    // 2. Cerca/Crea cartella tipo
    let tipoFolderId = await findOrCreateFolder(drive, annoFolderId, tipoFolder);
    
    return tipoFolderId;
  } catch (error) {
    console.error('Errore creazione cartella:', error);
    throw error;
  }
}

/**
 * Cerca una cartella per nome, se non esiste la crea
 */
async function findOrCreateFolder(drive, parentId, folderName) {
  try {
    // Cerca se esiste già
    const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (response.data.files && response.data.files.length > 0) {
      // Cartella esiste
      return response.data.files[0].id;
    }

    // Cartella non esiste, creala
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    };

    const folder = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id'
    });

    console.log(`✅ Cartella creata: ${folderName} (ID: ${folder.data.id})`);
    return folder.data.id;
  } catch (error) {
    console.error(`Errore find/create folder ${folderName}:`, error);
    throw error;
  }
}

/**
 * Carica un file su Google Drive
 */
async function uploadFile(drive, folderId, fileName, mimeType, fileBuffer) {
  try {
    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };

    // Crea stream correttamente dal Buffer
    const { Readable } = require('stream');
    const bufferStream = new Readable();
    bufferStream.push(fileBuffer);
    bufferStream.push(null); // Segnala fine stream

    const media = {
      mimeType: mimeType,
      body: bufferStream
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink'
    });

    console.log(`✅ File caricato su Drive: ${fileName}`);
    console.log(`   ID: ${file.data.id}`);
    console.log(`   Link: ${file.data.webViewLink}`);

    return {
      id: file.data.id,
      name: file.data.name,
      webViewLink: file.data.webViewLink,
      webContentLink: file.data.webContentLink
    };
  } catch (error) {
    console.error('Errore upload file:', error);
    throw error;
  }
}

/**
 * Rendi un file accessibile pubblicamente (opzionale)
 */
async function makeFilePublic(drive, fileId) {
  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
    console.log(`✅ File ${fileId} reso pubblico`);
  } catch (error) {
    console.error('Errore rendere file pubblico:', error);
    // Non lanciare errore, è opzionale
  }
}

module.exports = {
  getDriveClient,
  getOrCreateFolder,
  uploadFile,
  makeFilePublic
};
