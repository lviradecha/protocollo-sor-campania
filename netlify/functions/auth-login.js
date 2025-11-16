// netlify/functions/auth-login.js
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function getDbClient() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };
    }

    const client = await getDbClient();

    try {
        const { username, password } = JSON.parse(event.body);

        if (!username || !password) {
            await client.end();
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Username e password richiesti' })
            };
        }

        // Cerca utente
        const userResult = await client.query(
            `SELECT * FROM utenti 
             WHERE username = $1 AND attivo = true
             LIMIT 1`,
            [username.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            // Log tentativo fallito
            await client.query(
                `INSERT INTO audit_log (username, azione, dettagli, ip_address)
                 VALUES ($1, $2, $3, $4)`,
                [
                    username,
                    'LOGIN_FAILED',
                    JSON.stringify({ reason: 'user_not_found' }),
                    event.headers['x-forwarded-for'] || 'unknown'
                ]
            );

            await client.end();
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Username o password errati' 
                })
            };
        }

        const user = userResult.rows[0];

        // Verifica password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            // Log tentativo fallito
            await client.query(
                `INSERT INTO audit_log (user_id, username, nome_completo, azione, dettagli, ip_address)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    user.id,
                    user.username,
                    `${user.nome} ${user.cognome}`,
                    'LOGIN_FAILED',
                    JSON.stringify({ reason: 'wrong_password' }),
                    event.headers['x-forwarded-for'] || 'unknown'
                ]
            );

            await client.end();
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Username o password errati' 
                })
            };
        }

        // Aggiorna ultimo accesso
        await client.query(
            `UPDATE utenti 
             SET data_ultimo_accesso = NOW() 
             WHERE id = $1`,
            [user.id]
        );

        // Log successo
        await client.query(
            `INSERT INTO audit_log (user_id, username, nome_completo, azione, ip_address)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                user.id,
                user.username,
                `${user.nome} ${user.cognome}`,
                'LOGIN_SUCCESS',
                event.headers['x-forwarded-for'] || 'unknown'
            ]
        );

        await client.end();

        // Ritorna dati utente (senza password)
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    nome: user.nome,
                    cognome: user.cognome,
                    email: user.email,
                    ruolo: user.ruolo,
                    primoAccesso: user.primo_accesso
                },
                message: 'Login effettuato con successo'
            })
        };

    } catch (error) {
        console.error('Errore login:', error);
        await client.end();
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
