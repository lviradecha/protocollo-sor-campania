const { google } = require('googleapis');
const { Pool } = require('pg');

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Configurazione Gmail OAuth
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

// Funzione per convertire testo in HTML preservando la formattazione
function textToHtml(text) {
  // Se il testo contiene già tag HTML, restituiscilo così com'è
  if (text.includes('<') && text.includes('>')) {
    return text;
  }
  
  // Altrimenti converti newline in <br> e wrappa in un div
  return text.replace(/\n/g, '<br>');
}

// Funzione per ottenere o creare il label ID
async function getLabelId(labelPath) {
  try {
    const response = await gmail.users.labels.list({
      userId: 'me'
    });
    
    const label = response.data.labels.find(l => l.name === labelPath);
    
    if (label) {
      return label.id;
    }
    
    // Se non esiste, prova a crearlo
    console.log(`Label "${labelPath}" non trovato, tentativo di creazione...`);
    const createResponse = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: labelPath,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show'
      }
    });
    
    return createResponse.data.id;
  } catch (error) {
    console.error(`Errore recupero/creazione label ${labelPath}:`, error.message);
    throw error;
  }
}

// Funzione per estrarre gli header dall'email raw
function extractHeaders(rawEmail) {
  const lines = rawEmail.split('\r\n');
  const headers = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Fine degli header quando troviamo una riga vuota
    if (line === '') break;
    
    // Parsing degli header
    if (line.match(/^[A-Za-z-]+:/)) {
      const colonIndex = line.indexOf(':');
      const headerName = line.substring(0, colonIndex).trim();
      const headerValue = line.substring(colonIndex + 1).trim();
      headers[headerName.toLowerCase()] = headerValue;
    }
  }
  
  return headers;
}

// Funzione per estrarre il corpo HTML dall'email
async function extractEmailContent(messageId) {
  try {
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });
    
    let htmlBody = '';
    let textBody = '';
    
    // Funzione ricorsiva per estrarre il corpo
    function extractBody(part) {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        textBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
      
      if (part.parts) {
        part.parts.forEach(extractBody);
      }
    }
    
    extractBody(message.data.payload);
    
    // Preferisci HTML se disponibile, altrimenti usa testo
    return htmlBody || textBody.replace(/\n/g, '<br>');
  } catch (error) {
    console.error('Errore estrazione contenuto:', error);
    return '';
  }
}

// Funzione per estrarre allegati dall'email originale
async function extractAttachments(messageId, payload) {
  const attachments = [];
  
  async function extractFromPart(part) {
    if (part.filename && part.body && part.body.attachmentId) {
      try {
        const attachment = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: messageId,
          id: part.body.attachmentId
        });
        
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          data: attachment.data.data
        });
      } catch (error) {
        console.error(`Errore recupero allegato ${part.filename}:`, error.message);
      }
    }
    
    if (part.parts) {
      for (const subPart of part.parts) {
        await extractFromPart(subPart);
      }
    }
  }
  
  await extractFromPart(payload);
  return attachments;
}

// Funzione per creare email inoltrata identica a Gmail manuale
async function createGmailStyleForward(to, cc, customMessage, originalMessage, messageId) {
  const boundary = '----=_Part_' + Date.now();
  
  // Estrai headers dall'email originale
  const headers = originalMessage.payload.headers;
  const from = headers.find(h => h.name === 'From')?.value || '';
  const date = headers.find(h => h.name === 'Date')?.value || '';
  const subject = headers.find(h => h.name === 'Subject')?.value || '';
  const toOriginal = headers.find(h => h.name === 'To')?.value || '';
  const ccOriginal = headers.find(h => h.name.toLowerCase() === 'cc')?.value || '';
  
  console.log(`DEBUG - CC originale: "${ccOriginal}"`);
  
  // Estrai il corpo HTML dell'email originale
  const originalBodyHtml = await extractEmailContent(messageId);
  
  // Estrai gli allegati
  const attachments = await extractAttachments(messageId, originalMessage.payload);
  
  // Costruisci l'HTML del forward in stile Gmail
  let forwardHtml = `<div dir="ltr">${customMessage}</div><br><br>`;
  forwardHtml += `<div class="gmail_quote">`;
  forwardHtml += `---------- Messaggio inoltrato ---------<br>`;
  forwardHtml += `Da: <strong>${from}</strong><br>`;
  forwardHtml += `Data: ${new Date(date).toLocaleString('it-IT', { 
    weekday: 'short', 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}<br>`;
  forwardHtml += `Oggetto: ${subject}<br>`;
  forwardHtml += `A: ${toOriginal}<br>`;
  if (ccOriginal && ccOriginal.trim() !== '') {
    forwardHtml += `Cc: ${ccOriginal}<br>`;
  }
  forwardHtml += `<br><br>`;
  forwardHtml += originalBodyHtml;
  forwardHtml += `</div>`;
  
  // Costruisci il messaggio MIME
  let message = [
    `To: ${to.join(', ')}`,
  ];
  
  if (cc && cc.length > 0) {
    message.push(`Cc: ${cc.join(', ')}`);
  }
  
  message.push(
    `Subject: Fwd: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    forwardHtml,
    ''
  );
  
  // Aggiungi allegati con encoding corretto (linee da 76 caratteri)
  for (const att of attachments) {
    message.push(`--${boundary}`);
    message.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`);
    message.push('Content-Transfer-Encoding: base64');
    message.push(`Content-Disposition: attachment; filename="${att.filename}"`);
    message.push('');
    
    // Gli allegati da Gmail API sono già in base64, ma vanno divisi in linee da 76 caratteri
    const base64Data = att.data;
    const lines = base64Data.match(/.{1,76}/g) || [];
    lines.forEach(line => message.push(line));
    
    message.push('');
  }
  
  message.push(`--${boundary}--`);
  
  return Buffer.from(message.join('\r\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Funzione principale
exports.handler = async (event, context) => {
  const requestId = context.awsRequestId?.substring(0, 8) || 'manual';
  console.log(`${requestId} INFO  🔄 Avvio processo inoltro automatico email`);
  
  let client;
  
  try {
    // Connessione al database
    client = await pool.connect();
    
    // 1. Recupera le regole attive
    const regoleResult = await client.query(`
      SELECT * FROM regole_inoltro_email 
      WHERE attivo = true 
      ORDER BY id
    `);
    
    if (regoleResult.rows.length === 0) {
      console.log(`${requestId} INFO  ℹ️  Nessuna regola di inoltro attiva`);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Nessuna regola attiva' })
      };
    }
    
    console.log(`${requestId} INFO  📋 Trovate ${regoleResult.rows.length} regole attive`);
    
    // Ottieni il label ID per PROTOCOLLATO/INOLTRATO
    const inoltratoLabelId = await getLabelId('PROTOCOLLATO/INOLTRATO');
    console.log(`${requestId} INFO  🏷️  Label ID PROTOCOLLATO/INOLTRATO: ${inoltratoLabelId}`);
    
    // 2. Recupera email non lette (o con label specifico)
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: `is:unread -label:PROTOCOLLATO -label:"PROTOCOLLATO/INOLTRATO"`,
      maxResults: 50
    });
    
    if (!response.data.messages || response.data.messages.length === 0) {
      console.log(`${requestId} INFO  🔭 Nessuna email da processare`);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Nessuna email da inoltrare' })
      };
    }
    
    console.log(`${requestId} INFO  📧 Trovate ${response.data.messages.length} email da analizzare`);
    
    let emailInoltrate = 0;
    
    // 3. Processa ogni email
    for (const message of response.data.messages) {
      try {
        // Recupera email completa in formato FULL
        const emailDetails = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });
        
        const headers = emailDetails.data.payload.headers;
        const mittente = headers.find(h => h.name === 'From')?.value || '';
        const oggetto = headers.find(h => h.name === 'Subject')?.value || '';
        const data = headers.find(h => h.name === 'Date')?.value || '';
        
        console.log(`${requestId} INFO    📨 Email da: ${mittente}`);
        console.log(`${requestId} INFO    📝 Oggetto: ${oggetto}`);
        
        // 4. Controlla se qualche regola si applica
        for (const regola of regoleResult.rows) {
          let match = true;
          
          // Controlla pattern oggetto
          if (regola.pattern_oggetto) {
            const pattern = regola.pattern_oggetto.replace(/%/g, '.*');
            const regex = new RegExp(pattern, 'i');
            if (!regex.test(oggetto)) {
              match = false;
            }
          }
          
          // Controlla pattern mittente
          if (match && regola.pattern_mittente) {
            const pattern = regola.pattern_mittente.replace(/%/g, '.*');
            const regex = new RegExp(pattern, 'i');
            if (!regex.test(mittente)) {
              match = false;
            }
          }
          
          // Se c'è match, inoltra
          if (match) {
            console.log(`${requestId} INFO    ✅ Match con regola: ${regola.nome_regola}`);
            
            try {
              // Genera messaggio personalizzato (usa direttamente il template come HTML)
              const messaggioPersonalizzato = textToHtml(regola.corpo_template);
              
              // Crea email inoltrata in stile Gmail manuale
              const rawMessage = await createGmailStyleForward(
                regola.destinatari,
                regola.destinatari_cc || [],
                messaggioPersonalizzato,
                emailDetails.data,
                message.id
              );
              
              await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                  raw: rawMessage
                }
              });
              
              console.log(`${requestId} INFO    ✉️  Email inoltrata a: ${regola.destinatari.join(', ')}`);
              
              // Log nel database
              await client.query(`
                INSERT INTO log_inoltri_email 
                (regola_id, email_id, mittente, oggetto, destinatari, destinatari_cc, esito)
                VALUES ($1, $2, $3, $4, $5, $6, 'successo')
              `, [regola.id, message.id, mittente, oggetto, regola.destinatari, regola.destinatari_cc || []]);
              
              emailInoltrate++;
              
              // Aggiungi label PROTOCOLLATO/INOLTRATO e marca come letta
              await gmail.users.messages.modify({
                userId: 'me',
                id: message.id,
                requestBody: {
                  addLabelIds: [inoltratoLabelId],
                  removeLabelIds: ['UNREAD']
                }
              });
              
              console.log(`${requestId} INFO    🏷️  Label applicata: PROTOCOLLATO/INOLTRATO`);
              
            } catch (error) {
              console.error(`${requestId} ERROR   ❌ Errore inoltrando email: ${error.message}`);
              
              // Log errore nel database
              await client.query(`
                INSERT INTO log_inoltri_email 
                (regola_id, email_id, mittente, oggetto, destinatari, destinatari_cc, esito, errore)
                VALUES ($1, $2, $3, $4, $5, $6, 'errore', $7)
              `, [regola.id, message.id, mittente, oggetto, regola.destinatari, regola.destinatari_cc || [], error.message]);
            }
            
            // Una sola regola per email (prima che matcha)
            break;
          }
        }
        
      } catch (error) {
        console.error(`${requestId} ERROR   ❌ Errore processando email ${message.id}: ${error.message}`);
      }
    }
    
    console.log(`${requestId} INFO  ✅ Processo completato: ${emailInoltrate} email inoltrate`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Processo completato',
        emailInoltrate 
      })
    };
    
  } catch (error) {
    console.error(`${requestId} ERROR ❌ Errore generale: ${error.message}`);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  } finally {
    if (client) client.release();
  }
};
