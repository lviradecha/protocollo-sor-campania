-- Database Schema per Sistema Protocollazione SOR Campania
-- PostgreSQL (Neon Database)

-- Tabella principale protocolli
CREATE TABLE IF NOT EXISTS protocolli (
    id SERIAL PRIMARY KEY,
    numero_protocollo VARCHAR(20) NOT NULL UNIQUE,
    anno INTEGER NOT NULL,
    numero_progressivo INTEGER NOT NULL,
    tipo_protocollo CHAR(1) NOT NULL CHECK (tipo_protocollo IN ('E', 'U', 'I')),
    data_protocollo TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    mittente_destinatario TEXT,
    oggetto TEXT NOT NULL,
    categoria VARCHAR(50) DEFAULT 'SOR',
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabella allegati/documenti
CREATE TABLE IF NOT EXISTS documenti (
    id SERIAL PRIMARY KEY,
    protocollo_id INTEGER REFERENCES protocolli(id) ON DELETE CASCADE,
    nome_file_originale VARCHAR(255) NOT NULL,
    nome_file_protocollato VARCHAR(255) NOT NULL,
    url_documento TEXT,
    dimensione_kb INTEGER,
    mime_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabella email processate (per evitare duplicati)
CREATE TABLE IF NOT EXISTS email_processate (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) NOT NULL UNIQUE,
    protocollo_id INTEGER REFERENCES protocolli(id),
    gmail_thread_id VARCHAR(255),
    processato_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabella log attività
CREATE TABLE IF NOT EXISTS log_attivita (
    id SERIAL PRIMARY KEY,
    tipo_evento VARCHAR(50) NOT NULL,
    descrizione TEXT,
    protocollo_id INTEGER REFERENCES protocolli(id),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indici per performance
CREATE INDEX idx_protocolli_numero ON protocolli(numero_protocollo);
CREATE INDEX idx_protocolli_anno_tipo ON protocolli(anno, tipo_protocollo);
CREATE INDEX idx_protocolli_data ON protocolli(data_protocollo DESC);
CREATE INDEX idx_documenti_protocollo ON documenti(protocollo_id);
CREATE INDEX idx_email_message_id ON email_processate(message_id);
CREATE INDEX idx_log_tipo_data ON log_attivita(tipo_evento, created_at DESC);

-- View per statistiche
CREATE OR REPLACE VIEW stats_protocolli AS
SELECT 
    anno,
    tipo_protocollo,
    COUNT(*) as totale,
    MIN(data_protocollo) as primo_protocollo,
    MAX(data_protocollo) as ultimo_protocollo
FROM protocolli
GROUP BY anno, tipo_protocollo
ORDER BY anno DESC, tipo_protocollo;

-- Funzione per generare prossimo numero protocollo
CREATE OR REPLACE FUNCTION get_prossimo_numero_protocollo(
    p_anno INTEGER,
    p_tipo CHAR(1)
) RETURNS VARCHAR AS $$
DECLARE
    v_numero_progressivo INTEGER;
    v_numero_formattato VARCHAR(4);
    v_numero_protocollo VARCHAR(20);
BEGIN
    -- Ottieni il prossimo numero progressivo
    SELECT COALESCE(MAX(numero_progressivo), 0) + 1
    INTO v_numero_progressivo
    FROM protocolli
    WHERE anno = p_anno AND tipo_protocollo = p_tipo;
    
    -- Formatta con 4 cifre
    v_numero_formattato := LPAD(v_numero_progressivo::TEXT, 4, '0');
    
    -- Costruisci il numero protocollo: -ANNO-NNNNTipo
    v_numero_protocollo := '-' || p_anno || '-' || v_numero_formattato || p_tipo;
    
    RETURN v_numero_protocollo;
END;
$$ LANGUAGE plpgsql;

-- Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_protocolli_updated_at
    BEFORE UPDATE ON protocolli
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Inserisci dati di esempio (opzionale - rimuovere in produzione)
-- INSERT INTO protocolli (numero_protocollo, anno, numero_progressivo, tipo_protocollo, oggetto, mittente_destinatario)
-- VALUES ('-2025-0001E', 2025, 1, 'E', 'Test email protocollo', 'test@example.com');

-- Commenti sulle tabelle
COMMENT ON TABLE protocolli IS 'Registro principale dei protocolli SOR Campania';
COMMENT ON TABLE documenti IS 'Allegati e documenti collegati ai protocolli';
COMMENT ON TABLE email_processate IS 'Tracciamento email già protocollate per evitare duplicati';
COMMENT ON TABLE log_attivita IS 'Log di tutte le operazioni eseguite nel sistema';

COMMENT ON COLUMN protocolli.numero_protocollo IS 'Formato: -ANNO-NNNNTipo (es. -2025-0064U)';
COMMENT ON COLUMN protocolli.tipo_protocollo IS 'E=Entrata, U=Uscita, I=Interno';
