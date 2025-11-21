const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { Client } = require('pg');
const { google } = require('googleapis');
const { getDriveClient, getOrCreateFolder, uploadFile } = require('./drive-helper');

// ====================================
// FUNZIONE GENERAZIONE NUMERO PROTOCOLLO
// ====================================
async function generaNumeroProtocollo(client, tipoProtocollo, anno) {
  try {
    // Lock row per evitare race conditions
    const lockQuery = `
      SELECT ultimo_numero 
      FROM contatori_protocolli 
      WHERE anno = $1 AND tipo_protocollo = $2
      FOR UPDATE
    `;

    let result = await client.query(lockQuery, [anno, tipoProtocollo]);

    let ultimoNumero;

    if (result.rows.length === 0) {
      // Primo protocollo di questo tipo/anno
      let numeroIniziale = 0;
      
      // Se tipo U e anno 2025, parti da 88
      if (tipoProtocollo === 'U' && anno === 2025) {
        numeroIniziale = 88;
      }

      await client.query(
        `INSERT INTO contatori_protocolli (anno, tipo_protocollo, ultimo_numero)
         VALUES ($1, $2, $3)`,
        [anno, tipoProtocollo, numeroIniziale]
      );

      ultimoNumero = numeroIniziale;
    } else {
      ultimoNumero = result.rows[0].ultimo_numero;
    }

    // Incrementa
    const nuovoNumero = ultimoNumero + 1;

    // Aggiorna contatore
    await client.query(
      `UPDATE contatori_protocolli 
       SET ultimo_numero = $1, data_aggiornamento = CURRENT_TIMESTAMP
       WHERE anno = $2 AND tipo_protocollo = $3`,
      [nuovoNumero, anno, tipoProtocollo]
    );

    // Formatta numero protocollo: 2025/0001/SOR/E
    const numeroFormattato = `${anno}/${String(nuovoNumero).padStart(4, '0')}/SOR/${tipoProtocollo}`;

    console.log(`✅ Generato numero protocollo: ${numeroFormattato}`);

    return { numeroProtocollo: numeroFormattato, numeroProgressivo: nuovoNumero };

  } catch (error) {
    console.error('❌ Errore generazione numero protocollo:', error);
    throw error;
  }
}

// ====================================
// FUNZIONE DB CLIENT
// ====================================
async function getDbClient() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
}

// ====================================
// HANDLER PRINCIPALE
// ====================================
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
    const { pdfBase64, tipoProtocollo, oggetto, destinatari } = body;

    if (!pdfBase64 || !tipoProtocollo) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'PDF e tipo protocollo obbligatori' })
      };
    }

    console.log(`📄 Avvio protocollazione PDF - Tipo: ${tipoProtocollo}`);

    // Connessione database
    client = await getDbClient();
    console.log('✅ Connesso al database');

    // Decodifica PDF
    const pdfBytes = Buffer.from(pdfBase64, 'base64');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    console.log(`✅ PDF caricato (${pdfDoc.getPageCount()} pagine)`);

    // Inizia transazione
    await client.query('BEGIN');

    try {
      // ====================================
      // GENERA NUMERO PROTOCOLLO CON CONTATORI
      // ====================================
      const anno = new Date().getFullYear();
      const { numeroProtocollo, numeroProgressivo } = await generaNumeroProtocollo(
        client, 
        tipoProtocollo, 
        anno
      );
      console.log(`🔢 Numero protocollo generato: ${numeroProtocollo}`);

      // ==========================
      // AGGIUNGI INTESTAZIONE PDF
      // ==========================
      const intestazione1 = '-- CROCE ROSSA ITALIANA SOR Campania --';
      const dataFormattata = new Date().toLocaleDateString('it-IT');
      const intestazione2 = `-- Protocollo informatico n. ${numeroProtocollo} del ${dataFormattata} --`;

      const pages = pdfDoc.getPages();
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Applica intestazioni a tutte le pagine del PDF
      for (const page of pages) {
        const { height } = page.getSize();
        const fontSize = 8;
        const marginLeft = 40;

        // Prima riga
        page.drawText(intestazione1, {
          x: marginLeft,
          y: height - 30,
          size: fontSize,
          font,
          color: rgb(0.827, 0.184, 0.184) // Rosso CRI
        });

        // Seconda riga
        page.drawText(intestazione2, {
          x: marginLeft,
          y: height - 40,
          size: fontSize,
          font,
          color: rgb(0.827, 0.184, 0.184)
        });
      }

      console.log('✅ Intestazioni aggiunte su tutte le pagine');

      // Salva PDF protocollato
      const pdfProtocollatoBytes = await pdfDoc.save();
      const pdfProtocollatoBase64 = Buffer.from(pdfProtocollatoBytes).toString('base64');

      // ====================================
      // GOOGLE DRIVE UPLOAD
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
      console.log('✅ Google Drive client inizializzato');

      // Ottieni cartella Drive per anno/tipo
      const driveFolderId = await getOrCreateFolder(
        drive,
        process.env.DRIVE_FOLDER_ID,
        anno,
        tipoProtocollo
      );
      console.log(`📁 Cartella Drive ID: ${driveFolderId}`);

      // Nome file per Drive
      const oggettoSanitized = (oggetto || 'documento')
        .replace(/[\/\\:*?"<>|]/g, '_')      // Sostituisce solo caratteri vietati nei filesystem
        .replace(/\s+/g, '_')                // Sostituisce spazi con underscore
        .substring(0, 150);                  // Max 150 caratteri per l'oggetto
      
      const numeroSemplice = String(numeroProgressivo).padStart(4, '0');
      const nomeFileProtocollato = `${numeroSemplice}${tipoProtocollo}_SOR_CAMPANIA_${oggettoSanitized}.pdf`;
      
      console.log(`📄 Nome file: ${nomeFileProtocollato}`);

      // Upload su Google Drive
      const driveFile = await uploadFile(
        drive,
        driveFolderId,
        nomeFileProtocollato,
        'application/pdf',
        pdfProtocollatoBytes
      );
      console.log(`✅ PDF caricato su Drive: ${driveFile.webViewLink}`);

      // ====================================
      // SALVA DATABASE
      // ====================================
      const insertProtocollo = await client.query(
        `INSERT INTO protocolli 
         (numero_protocollo, anno, numero_progressivo, tipo_protocollo, oggetto, mittente_destinatario, categoria, data_protocollo) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id`,
        [
          numeroProtocollo,
          anno,
          numeroProgressivo,
          tipoProtocollo,
          oggetto || 'Documento caricato',
          destinatari || 'N/A',
          'SOR',
          new Date()
        ]
      );

      const protocolloId = insertProtocollo.rows[0].id;
      console.log(`✅ Protocollo salvato nel DB (ID: ${protocolloId})`);

      // Salva documento con URL Drive
      await client.query(
        `INSERT INTO documenti 
         (protocollo_id, nome_file_originale, nome_file_protocollato, url_documento, dimensione_kb, mime_type) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          protocolloId,
          'documento_caricato.pdf',
          nomeFileProtocollato,
          driveFile.webViewLink,
          Math.round(pdfProtocollatoBytes.length / 1024),
          'application/pdf'
        ]
      );
      console.log('✅ Documento salvato con URL Drive');

      // Log attività
      await client.query(
        `INSERT INTO log_attivita (tipo_evento, descrizione, protocollo_id, metadata) 
         VALUES ($1, $2, $3, $4)`,
        [
          'PDF_PROTOCOLLATO',
          `PDF protocollato manualmente: ${numeroProtocollo}`,
          protocolloId,
          JSON.stringify({ 
            tipo: tipoProtocollo, 
            oggetto, 
            destinatari,
            driveUrl: driveFile.webViewLink
          })
        ]
      );

      await client.query('COMMIT');
      console.log('✅ Transazione completata');

      // ====================================
      // RISPOSTA
      // ====================================
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Disposition': `attachment; filename="${nomeFileProtocollato}"`
        },
        body: JSON.stringify({
          success: true,
          numeroProtocollo,
          pdfBase64: pdfProtocollatoBase64,
          protocolloId,
          dataProtocollo: dataFormattata,
          driveUrl: driveFile.webViewLink,
          nomeFile: nomeFileProtocollato
        })
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Errore durante transazione:', error);
      throw error;
    }

  } catch (error) {
    console.error('❌ Errore protocollazione PDF:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Errore durante la protocollazione',
        message: error.message
      })
    };
  } finally {
    if (client) {
      await client.end();
    }
  }
};

// ====================================
// EXPORT
// ====================================
module.exports = {
  handler: exports.handler,
  generaNumeroProtocollo
};
