-- Schema autenticazione per protocollo-sor-campania

-- Tabella utenti
CREATE TABLE IF NOT EXISTS utenti (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nome VARCHAR(100) NOT NULL,
    cognome VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    ruolo VARCHAR(20) CHECK (ruolo IN ('admin', 'operatore')) DEFAULT 'operatore',
    attivo BOOLEAN DEFAULT true,
    primo_accesso BOOLEAN DEFAULT true,
    data_ultimo_accesso TIMESTAMP,
    data_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES utenti(id),
    username VARCHAR(50),
    nome_completo VARCHAR(200),
    azione VARCHAR(50) NOT NULL,
    dettagli JSONB,
    ip_address VARCHAR(50),
    data_azione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_azione ON audit_log(azione);
CREATE INDEX IF NOT EXISTS idx_audit_log_data ON audit_log(data_azione);

-- Utente admin di default (password: Admin2025!)
-- IMPORTANTE: cambiare la password al primo accesso!
INSERT INTO utenti (username, password_hash, nome, cognome, email, ruolo, primo_accesso)
VALUES (
    'admin',
    '$2a$10$XQVQYGvN5z8pY9K.qR5gNuXHJzJQGW0vK5yVZX8xMF7YJ6fT3QRPC',
    'Amministratore',
    'Sistema',
    'admin@sor-campania.cri.it',
    'admin',
    true
) ON CONFLICT (username) DO NOTHING;

-- Commenti
COMMENT ON TABLE utenti IS 'Utenti del sistema protocollo SOR Campania';
COMMENT ON TABLE audit_log IS 'Log di audit per tracciamento azioni utenti';
COMMENT ON COLUMN utenti.primo_accesso IS 'Se true, l''utente deve cambiare password al primo login';
COMMENT ON COLUMN utenti.ruolo IS 'admin: accesso completo | operatore: solo protocollazione e visualizzazione';
