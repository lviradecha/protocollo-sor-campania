-- ========================================
-- AGGIORNAMENTI DATABASE - 2 Novembre 2025
-- Sistema Protocollo e Attestati SOR Campania
-- ========================================

-- 1. AGGIUNGERE COLONNE PER STATO EMAIL
-- ========================================

ALTER TABLE attestati 
ADD COLUMN IF NOT EXISTS email_inviata BOOLEAN DEFAULT FALSE;

ALTER TABLE attestati 
ADD COLUMN IF NOT EXISTS email_destinatario VARCHAR(255);

-- Commento sulle colonne:
-- email_inviata: TRUE se l'email è stata inviata con successo
-- email_destinatario: Indirizzo email del destinatario (può essere NULL)

-- ========================================
-- 2. VERIFICA STRUTTURA TABELLA
-- ========================================

-- Verifica che tutte le colonne siano presenti
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'attestati'
ORDER BY ordinal_position;

-- Output atteso:
-- id | integer | NO
-- nome | varchar | NO
-- cognome | varchar | NO
-- codice_fiscale | varchar | NO
-- nome_evento | varchar | NO
-- tipo_evento | text | YES
-- descrizione_evento | text | YES
-- data_conferimento | varchar | YES
-- nome_file | varchar | YES
-- url_drive | text | YES
-- drive_file_id | varchar | YES
-- data_generazione | timestamp | YES
-- email_inviata | boolean | YES
-- email_destinatario | varchar | YES

-- ========================================
-- 3. INDICI (già esistenti, solo verifica)
-- ========================================

-- Verifica indici esistenti
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'attestati';

-- Output atteso:
-- attestati_pkey
-- attestati_codice_fiscale_nome_evento_key (UNIQUE)
-- idx_attestati_codice_fiscale
-- idx_attestati_nome_evento
-- idx_attestati_data_generazione

-- ========================================
-- 4. QUERY UTILI PER MONITORAGGIO
-- ========================================

-- Conta attestati con email inviata
SELECT 
  COUNT(*) FILTER (WHERE email_inviata = TRUE) as email_inviate,
  COUNT(*) FILTER (WHERE email_inviata = FALSE AND email_destinatario IS NOT NULL) as email_non_inviate,
  COUNT(*) FILTER (WHERE email_destinatario IS NULL) as senza_email,
  COUNT(*) as totale
FROM attestati;

-- Attestati per evento con stato email
SELECT 
  nome_evento,
  COUNT(*) as totale_attestati,
  COUNT(*) FILTER (WHERE email_inviata = TRUE) as email_inviate,
  COUNT(*) FILTER (WHERE email_inviata = FALSE AND email_destinatario IS NOT NULL) as email_non_inviate
FROM attestati
GROUP BY nome_evento
ORDER BY totale_attestati DESC;

-- Ultimi 10 attestati generati con stato email
SELECT 
  nome,
  cognome,
  nome_evento,
  email_destinatario,
  email_inviata,
  data_generazione
FROM attestati
ORDER BY data_generazione DESC
LIMIT 10;

-- ========================================
-- 5. MANUTENZIONE (OPZIONALE)
-- ========================================

-- Pulisci attestati di test (se necessario)
-- ATTENZIONE: Decommentare solo se necessario!
-- DELETE FROM attestati WHERE nome_evento LIKE '%TEST%';

-- Rimuovi attestati senza Drive URL più vecchi di 6 mesi (se necessario)
-- ATTENZIONE: Decommentare solo se necessario!
-- DELETE FROM attestati 
-- WHERE url_drive IS NULL 
-- AND data_generazione < NOW() - INTERVAL '6 months';

-- ========================================
-- 6. BACKUP (CONSIGLIATO)
-- ========================================

-- Prima di eseguire le modifiche, fai un backup:
-- pg_dump -h YOUR_HOST -U YOUR_USER -d YOUR_DB -t attestati > backup_attestati_02nov2025.sql

-- ========================================
-- FINE SCRIPT
-- ========================================

-- Per applicare queste modifiche:
-- 1. Connettiti al database PostgreSQL
-- 2. Esegui questo script
-- 3. Verifica che le colonne siano state create
-- 4. Testa il sistema di generazione attestati

-- ✅ Script completato!
