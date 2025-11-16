-- ====================================
-- TABELLA ATTESTATI
-- ====================================

CREATE TABLE IF NOT EXISTS attestati (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cognome VARCHAR(100) NOT NULL,
    codice_fiscale VARCHAR(16) NOT NULL,
    nome_evento VARCHAR(255) NOT NULL,
    tipo_evento TEXT,
    descrizione_evento TEXT,
    data_conferimento VARCHAR(50),
    nome_file VARCHAR(255),
    url_drive TEXT,
    drive_file_id VARCHAR(100),
    data_generazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(codice_fiscale, nome_evento)
);

-- Indici per ricerca veloce
CREATE INDEX IF NOT EXISTS idx_attestati_codice_fiscale ON attestati(codice_fiscale);
CREATE INDEX IF NOT EXISTS idx_attestati_nome_evento ON attestati(nome_evento);
CREATE INDEX IF NOT EXISTS idx_attestati_data_generazione ON attestati(data_generazione DESC);

-- Commenti
COMMENT ON TABLE attestati IS 'Registro degli attestati di partecipazione generati';
COMMENT ON COLUMN attestati.url_drive IS 'Link Google Drive per visualizzare/scaricare l''attestato';
COMMENT ON COLUMN attestati.drive_file_id IS 'ID del file su Google Drive per gestione';
