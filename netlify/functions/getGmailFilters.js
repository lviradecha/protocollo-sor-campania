const { google } = require('googleapis');

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

exports.handler = async (event, context) => {
  const requestId = context.awsRequestId?.substring(0, 8) || 'manual';
  
  try {
    console.log(`${requestId} INFO  📋 Recupero filtri Gmail esistenti`);
    
    // Ottieni tutti i filtri Gmail
    const response = await gmail.users.settings.filters.list({
      userId: 'me'
    });
    
    const filters = response.data.filter || [];
    
    console.log(`${requestId} INFO  ✅ Trovati ${filters.length} filtri`);
    
    // Mappa i filtri in un formato più leggibile
    const filtriFormattati = filters.map(filter => {
      const criteria = filter.criteria || {};
      const action = filter.action || {};
      
      // Estrai pattern oggetto
      let patternOggetto = '';
      if (criteria.subject) {
        patternOggetto = `%${criteria.subject}%`;
      } else if (criteria.query) {
        // Prova a estrarre subject dalla query
        const subjectMatch = criteria.query.match(/subject:\(([^)]+)\)/);
        if (subjectMatch) {
          patternOggetto = `%${subjectMatch[1]}%`;
        }
      }
      
      // Estrai pattern mittente
      let patternMittente = '';
      if (criteria.from) {
        patternMittente = `%${criteria.from}%`;
      } else if (criteria.query) {
        // Prova a estrarre from dalla query
        const fromMatch = criteria.query.match(/from:\(([^)]+)\)/);
        if (fromMatch) {
          patternMittente = `%${fromMatch[1]}%`;
        }
      }
      
      // Estrai label applicato
      let labelNome = '';
      if (action.addLabelIds && action.addLabelIds.length > 0) {
        labelNome = action.addLabelIds[0];
      }
      
      return {
        id: filter.id,
        patternOggetto,
        patternMittente,
        label: labelNome,
        criteriaRaw: criteria,
        descrizione: generaDescrizione(criteria, action)
      };
    }).filter(f => f.patternOggetto || f.patternMittente); // Solo filtri con pattern utili
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filtriFormattati)
    };
    
  } catch (error) {
    console.error(`${requestId} ERROR ❌ Errore recupero filtri: ${error.message}`);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Genera descrizione leggibile del filtro
function generaDescrizione(criteria, action) {
  const parti = [];
  
  if (criteria.from) {
    parti.push(`Da: ${criteria.from}`);
  }
  if (criteria.to) {
    parti.push(`A: ${criteria.to}`);
  }
  if (criteria.subject) {
    parti.push(`Oggetto: ${criteria.subject}`);
  }
  if (criteria.hasAttachment) {
    parti.push('Con allegati');
  }
  
  let descrizione = parti.join(' | ');
  
  if (action.addLabelIds && action.addLabelIds.length > 0) {
    descrizione += ` → Applica label`;
  }
  
  return descrizione || 'Filtro Gmail';
}
