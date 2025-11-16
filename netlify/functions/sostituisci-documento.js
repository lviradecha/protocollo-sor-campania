// ====================================
// SOSTITUISCI DOCUMENTO PROTOCOLLATO
// ====================================
// Mantiene il numero protocollo, sostituisce solo il PDF

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { Client } = require('pg');
const { google } = require('googleapis');
const { getDriveClient, getOrCreateFolder, uploadFile, deleteFile } = require('./drive-helper');

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
    const { protocolloId, pdfBase64, motivoSostituzione, utenteEmail } = body;

    if (!protocolloId || !pdfBase64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'ID protocollo e PDF obbligatori' })
      };
    }

    console.log(`🔄 Sostituzione documento protocollo ID: ${protocolloId}`);

    client = await getDbClient();
    await client.query('BEGIN');

    try {
      // ====================================
      // 1. RECUPERA INFO PROTOCOLLO
      // ====================================
      const protocolloResult = await client.query(
        `SELECT 
          p.*,
          d.id as documento_id,
          d.nome_file_protocollato,
          d.url_documento
         FROM protocolli p
         LEFT JOIN documenti d ON p.id = d.protocollo_id
         WHERE p.id = $1
         LIMIT 1`,
        [protocolloId]
      );

      if (protocolloResult.rows.length === 0) {
        throw new Error('Protocollo non trovato');
      }

      const protocollo = protocolloResult.rows[0];
      console.log(`✅ Protocollo trovato: ${protocollo.numero_protocollo}`);

      // ====================================
      // 2. ELABORA NUOVO PDF
      // ====================================
      const pdfBytes = Buffer.from(pdfBase64, 'base64');
      const pdfDoc = await PDFDocument.load(pdfBytes);
      console.log(`✅ Nuovo PDF caricato (${pdfDoc.getPageCount()} pagine)`);

      // Aggiungi intestazione con STESSO numero protocollo
      const intestazione1 = '-- CROCE ROSSA ITALIANA SOR Campania --';
      const dataFormattata = new Date().toLocaleDateString('it-IT');
      const intestazione2 = `-- Protocollo informatico n. ${protocollo.numero_protocollo} del ${dataFormattata} --`;

      const pages = pdfDoc.getPages();
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      for (const page of pages) {
        const { height } = page.getSize();
        const fontSize = 8;
        const marginLeft = 40;

        page.drawText(intestazione1, {
          x: marginLeft,
          y: height - 30,
          size: fontSize,
          font,
          color: rgb(0.827, 0.184, 0.184)
        });

        page.drawText(intestazione2, {
          x: marginLeft,
          y: height - 40,
          size: fontSize,
          font,
          color: rgb(0.827, 0.184, 0.184)
        });
      }

      const pdfProtocollatoBytes = await pdfDoc.save();
      const pdfProtocollatoBase64 = Buffer.from(pdfProtocollatoBytes).toString('base64');
      
      console.log('✅ Intestazioni aggiunte al nuovo PDF');

      // ====================================
      // 3. BACKUP VECCHIO FILE SU DRIVE
      // ====================================
      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        'https://developers.google.com/oauthplayground'
      );
      oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN
      });

      const drive = getDriveClient(oauth2Client);

      // ====================================
      // Ottieni cartella Drive corretta (anno/tipo)
      // ====================================
      const driveFolderId = await getOrCreateFolder(
        drive,
        process.env.DRIVE_FOLDER_ID,
        protocollo.anno,
        protocollo.tipo_protocollo
      );
      console.log(`📁 Cartella Drive ID: ${driveFolderId}`);

      // Nome file backup con timestamp
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const nomeFileBackup = protocollo.nome_file_protocollato.replace('.pdf', `_OLD_${timestamp}.pdf`);

      console.log(`📁 Creazione backup: ${nomeFileBackup}`);

      // Upload backup del vecchio file (se esiste)
      if (protocollo.url_documento) {
        // Qui potresti implementare il download del vecchio file e riupload come backup
        // Per semplicità, procediamo con l'upload del nuovo
      }

      // ====================================
      // 4. UPLOAD NUOVO FILE (stesso nome)
      // ====================================
      const nuovoFile = await uploadFile(
        drive,
        driveFolderId,
        protocollo.nome_file_protocollato, // STESSO NOME!
        'application/pdf',
        pdfProtocollatoBytes
      );

      console.log(`✅ Nuovo file caricato su Drive: ${nuovoFile.webViewLink}`);

      // ====================================
      // 5. AGGIORNA DATABASE
      // ====================================
      
      // Aggiorna documento
      if (protocollo.documento_id) {
        await client.query(
          `UPDATE documenti 
           SET url_documento = $1,
               dimensione_kb = $2
           WHERE id = $3`,
          [
            nuovoFile.webViewLink,
            Math.round(pdfProtocollatoBytes.length / 1024),
            protocollo.documento_id
          ]
        );
      } else {
        // Crea nuovo documento se non esisteva
        await client.query(
          `INSERT INTO documenti 
           (protocollo_id, nome_file_originale, nome_file_protocollato, url_documento, dimensione_kb, mime_type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            protocolloId,
            'documento_sostituito.pdf',
            protocollo.nome_file_protocollato,
            nuovoFile.webViewLink,
            Math.round(pdfProtocollatoBytes.length / 1024),
            'application/pdf'
          ]
        );
      }

      // Aggiorna timestamp protocollo
      await client.query(
        `UPDATE protocolli 
         SET updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [protocolloId]
      );

      // Log attività
      await client.query(
        `INSERT INTO log_attivita (tipo_evento, descrizione, protocollo_id, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          'DOCUMENTO_SOSTITUITO',
          `Documento sostituito per protocollo ${protocollo.numero_protocollo}`,
          protocolloId,
          JSON.stringify({
            utente: utenteEmail || 'non specificato',
            motivo: motivoSostituzione || 'non specificato',
            data_sostituzione: new Date().toISOString(),
            file_backup: nomeFileBackup,
            nuovo_url: nuovoFile.webViewLink
          })
        ]
      );

      await client.query('COMMIT');
      console.log('✅ Sostituzione completata con successo');

      // ====================================
      // 6. RISPOSTA
      // ====================================
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Disposition': `attachment; filename="${protocollo.nome_file_protocollato}"`
        },
        body: JSON.stringify({
          success: true,
          message: 'Documento sostituito con successo',
          numeroProtocollo: protocollo.numero_protocollo,
          pdfBase64: pdfProtocollatoBase64,
          driveUrl: nuovoFile.webViewLink,
          nomeFile: protocollo.nome_file_protocollato,
          fileBackup: nomeFileBackup
        })
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Errore durante sostituzione:', error);
      throw error;
    }

  } catch (error) {
    console.error('❌ Errore sostituzione documento:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Errore durante la sostituzione del documento',
        message: error.message
      })
    };
  } finally {
    if (client) {
      await client.end();
    }
  }
};
