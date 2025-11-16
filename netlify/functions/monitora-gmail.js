const { google } = require('googleapis');
const { Client } = require('pg');
const { getDriveClient, getOrCreateFolder, uploadFile } = require('./drive-helper');

// ====================================
// GENERA NUMERO PROTOCOLLO CON CONTATORI
// ====================================
async function generaNumeroProtocollo(client, tipoProtocollo, anno) {
  const lockQuery = `
    SELECT ultimo_numero 
    FROM contatori_protocolli 
    WHERE anno = $1 AND tipo_protocollo = $2
    FOR UPDATE
  `;

  let result = await client.query(lockQuery, [anno, tipoProtocollo]);
  let ultimoNumero;

  if (result.rows.length === 0) {
    let numeroIniziale = 0;
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

  const nuovoNumero = ultimoNumero + 1;
  await client.query(
    `UPDATE contatori_protocolli 
     SET ultimo_numero = $1, data_aggiornamento = CURRENT_TIMESTAMP
     WHERE anno = $2 AND tipo_protocollo = $3`,
    [nuovoNumero, anno, tipoProtocollo]
  );

  // Formato: 2025/0001/SOR/E
  const numeroFormattato = `${anno}/${String(nuovoNumero).padStart(4, '0')}/SOR/${tipoProtocollo}`;
  return { numeroProtocollo: numeroFormattato, numeroProgressivo: nuovoNumero };
}

async function getDbClient() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
}

exports.handler = async (event, context) => {
  console.log('🚀 Avvio monitoraggio Gmail per sor.campania@cri.it');

  let dbClient;

  try {
    // Validazione variabili ambiente
    const requiredEnvVars = [
      'GMAIL_CLIENT_ID', 
      'GMAIL_CLIENT_SECRET', 
      'GMAIL_REFRESH_TOKEN', 
      'GMAIL_EMAIL',
      'DATABASE_URL',
      'DRIVE_FOLDER_ID'
    ];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Variabili ambiente mancanti: ${missingVars.join(', ')}`);
    }

    // Connessione database
    dbClient = await getDbClient();
    console.log('✅ Connesso al database PostgreSQL');

    // Configurazione OAuth2 Gmail
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const drive = getDriveClient(oauth2Client);
    console.log('✅ Autenticazione Gmail completata');
    console.log('✅ Google Drive client inizializzato');

    // Cerca label Gmail
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const labels = labelsResponse.data.labels;
    
    const daProtocollareLabel = labels.find(l => l.name === 'DA_PROTOCOLLARE');
    const protocollatoLabel = labels.find(l => l.name === 'PROTOCOLLATO');

    if (!daProtocollareLabel) {
      console.log('⚠️ Label DA_PROTOCOLLARE non trovata');
      await dbClient.end();
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: 'Label DA_PROTOCOLLARE non trovata su Gmail'
        })
      };
    }

    console.log(`📧 Cerco email con label: ${daProtocollareLabel.name}`);

    // Cerca messaggi con il label
    const messagesResponse = await gmail.users.messages.list({
      userId: 'me',
      labelIds: [daProtocollareLabel.id],
      maxResults: 10
    });

    const messages = messagesResponse.data.messages || [];
    
    if (messages.length === 0) {
      console.log('✅ Nessuna email da protocollare');
      await dbClient.end();
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: 'Nessuna email da protocollare',
          count: 0
        })
      };
    }

    console.log(`📬 Trovate ${messages.length} email da protocollare`);

    let processate = 0;
    const protocolli = [];

    // Processa ogni email
    for (const message of messages) {
      try {
        // Ottieni dettagli email
        const emailData = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });

        const messageId = emailData.data.id;
        const headers = emailData.data.payload.headers;

        // Verifica se già protocollata
        const checkResult = await dbClient.query(
          'SELECT id FROM email_processate WHERE message_id = $1',
          [messageId]
        );

        if (checkResult.rows.length > 0) {
          console.log(`⏭️ Email ${messageId} già protocollata, skip`);
          continue;
        }

        // Estrai dati email
        const from = headers.find(h => h.name === 'From')?.value || 'N/A';
        const subject = headers.find(h => h.name === 'Subject')?.value || 'Senza oggetto';
        const date = new Date(parseInt(emailData.data.internalDate));

        console.log(`\n📧 Protocollazione email:`);
        console.log(`   Da: ${from}`);
        console.log(`   Oggetto: ${subject}`);
        console.log(`   Data: ${date.toISOString()}`);

        // Transazione database
        await dbClient.query('BEGIN');

        try {
          // ====================================
          // GENERA NUMERO CON CONTATORI
          // ====================================
          const anno = date.getFullYear();
          const { numeroProtocollo, numeroProgressivo } = await generaNumeroProtocollo(
            dbClient,
            'E',
            anno
          );
          console.log(`   🔢 Numero protocollo: ${numeroProtocollo}`);

          // Inserisci protocollo
          const insertProtocollo = await dbClient.query(
            `INSERT INTO protocolli 
             (numero_protocollo, anno, numero_progressivo, tipo_protocollo, oggetto, mittente_destinatario, categoria, data_protocollo) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             RETURNING id`,
            [
              numeroProtocollo,
              anno,
              numeroProgressivo,
              'E',
              subject,
              from,
              'SOR',
              date
            ]
          );

          const protocolloId = insertProtocollo.rows[0].id;
          console.log(`   ✅ Protocollo salvato nel DB (ID: ${protocolloId})`);

          // Ottieni cartella Drive
          const driveFolderId = await getOrCreateFolder(
            drive, 
            process.env.DRIVE_FOLDER_ID, 
            anno, 
            'E'
          );
          console.log(`   📁 Cartella Drive: ${driveFolderId}`);

          // Gestisci allegati
          if (emailData.data.payload.parts) {
            let allegatiCount = 0;
            for (const part of emailData.data.payload.parts) {
              if (part.filename && part.body.attachmentId) {
                try {
                  const attachment = await gmail.users.messages.attachments.get({
                    userId: 'me',
                    messageId: message.id,
                    id: part.body.attachmentId
                  });

                  const fileBuffer = Buffer.from(attachment.data.data, 'base64');
                  const nomeFileProtocollato = `${numeroProgressivo.toString().padStart(4, '0')}E_SOR_CAMPANIA_${part.filename}`;

                  const driveFile = await uploadFile(
                    drive,
                    driveFolderId,
                    nomeFileProtocollato,
                    part.mimeType,
                    fileBuffer
                  );

                  await dbClient.query(
                    `INSERT INTO documenti 
                     (protocollo_id, nome_file_originale, nome_file_protocollato, url_documento, dimensione_kb, mime_type) 
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                      protocolloId,
                      part.filename,
                      nomeFileProtocollato,
                      driveFile.webViewLink,
                      Math.round(fileBuffer.length / 1024),
                      part.mimeType
                    ]
                  );

                  allegatiCount++;
                  console.log(`   📎 Allegato salvato: ${part.filename}`);
                } catch (attachmentError) {
                  console.error(`   ⚠️ Errore allegato ${part.filename}:`, attachmentError.message);
                }
              }
            }
            if (allegatiCount > 0) {
              console.log(`   ✅ Salvati ${allegatiCount} allegati su Drive`);
            }
          }

          // Registra email processata
          await dbClient.query(
            'INSERT INTO email_processate (message_id, protocollo_id, gmail_thread_id) VALUES ($1, $2, $3)',
            [messageId, protocolloId, emailData.data.threadId]
          );

          // Log attività
          await dbClient.query(
            'INSERT INTO log_attivita (tipo_evento, descrizione, protocollo_id, metadata) VALUES ($1, $2, $3, $4)',
            [
              'EMAIL_PROTOCOLLATA',
              `Email protocollata automaticamente: ${numeroProtocollo}`,
              protocolloId,
              JSON.stringify({ from, subject, messageId })
            ]
          );

          await dbClient.query('COMMIT');
          console.log(`   ✅ Transazione completata`);

          // Cambia label su Gmail
          const modifyRequest = {
            userId: 'me',
            id: message.id,
            requestBody: {
              removeLabelIds: [daProtocollareLabel.id]
            }
          };

          if (protocollatoLabel) {
            modifyRequest.requestBody.addLabelIds = [protocollatoLabel.id];
          }

          await gmail.users.messages.modify(modifyRequest);
          console.log(`   ✅ Label Gmail aggiornati`);

          processate++;
          protocolli.push(numeroProtocollo);

        } catch (txError) {
          await dbClient.query('ROLLBACK');
          console.error(`   ❌ Errore transazione:`, txError.message);
          throw txError;
        }

      } catch (emailError) {
        console.error(`❌ Errore processando email ${message.id}:`, emailError.message);
        continue;
      }
    }

    await dbClient.end();
    console.log(`\n✅ Protocollazione completata: ${processate}/${messages.length} email processate`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Email protocollate con successo`,
        count: processate,
        total: messages.length,
        protocolli: protocolli
      })
    };

  } catch (error) {
    console.error('❌ ERRORE GENERALE:', error.message);
    
    if (dbClient) {
      try {
        await dbClient.end();
      } catch (endError) {
        console.error('Errore chiusura DB:', endError.message);
      }
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Errore monitoraggio Gmail',
        message: error.message
      })
    };
  }
};
