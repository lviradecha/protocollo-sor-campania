// netlify/functions/change-password.js
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
        const { userId, newPassword } = JSON.parse(event.body);

        if (!userId || !newPassword) {
            await client.end();
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Dati mancanti' })
            };
        }

        if (newPassword.length < 8) {
            await client.end();
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Password troppo corta (minimo 8 caratteri)' })
            };
        }

        // Hash nuova password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Aggiorna password e disattiva primo_accesso
        await client.query(
            `UPDATE utenti 
             SET password_hash = $1, primo_accesso = false 
             WHERE id = $2`,
            [passwordHash, userId]
        );

        // Ottieni dati utente per audit log
        const userResult = await client.query(
            `SELECT username, nome, cognome FROM utenti WHERE id = $1`,
            [userId]
        );

        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            
            await client.query(
                `INSERT INTO audit_log (user_id, username, nome_completo, azione, ip_address)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    userId,
                    user.username,
                    `${user.nome} ${user.cognome}`,
                    'CHANGE_PASSWORD',
                    event.headers['x-forwarded-for'] || 'unknown'
                ]
            );
        }

        await client.end();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, message: 'Password cambiata con successo' })
        };

    } catch (error) {
        console.error('Errore change-password:', error);
        await client.end();
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
