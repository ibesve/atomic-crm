-- Migration: Fix Audit Triggers für Tabellen ohne 'name' Feld
-- Das Problem: NEW.name funktioniert nicht für contacts (hat first_name/last_name)
-- ============================================

-- 1. Korrigierte Trigger-Funktion für Updates
CREATE OR REPLACE FUNCTION trigger_create_version_on_update()
RETURNS TRIGGER AS $$
DECLARE
  v_changed_fields TEXT[];
  v_change_summary TEXT;
  v_resource_name TEXT;
  v_old_json JSONB;
  v_new_json JSONB;
BEGIN
  -- Konvertiere zu JSONB für sicheren Zugriff
  v_old_json := to_jsonb(OLD);
  v_new_json := to_jsonb(NEW);
  
  -- Finde geänderte Felder
  SELECT array_agg(key) INTO v_changed_fields
  FROM (
    SELECT key
    FROM jsonb_each(v_new_json)
    WHERE v_new_json->key IS DISTINCT FROM v_old_json->key
      AND key NOT IN ('updated_at', 'last_seen')
  ) changed;
  
  -- Nur versionieren wenn es echte Änderungen gibt
  IF v_changed_fields IS NOT NULL AND array_length(v_changed_fields, 1) > 0 THEN
    v_change_summary := 'Geänderte Felder: ' || array_to_string(v_changed_fields, ', ');
    
    -- Ermittle Resource Name sicher über JSONB
    v_resource_name := COALESCE(
      v_new_json->>'name',
      NULLIF(CONCAT(v_new_json->>'first_name', ' ', v_new_json->>'last_name'), ' '),
      NEW.id::TEXT
    );
    
    -- Erstelle Version
    PERFORM create_record_version(
      TG_TABLE_NAME,
      NEW.id,
      v_old_json,
      v_change_summary
    );
    
    -- Erstelle Audit Log
    PERFORM create_audit_log(
      'update'::audit_action_type,
      TG_TABLE_NAME,
      NEW.id,
      v_resource_name,
      v_old_json,
      v_new_json,
      v_changed_fields,
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Korrigierte Trigger-Funktion für Inserts
CREATE OR REPLACE FUNCTION trigger_audit_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_resource_name TEXT;
  v_new_json JSONB;
BEGIN
  -- Konvertiere zu JSONB für sicheren Zugriff
  v_new_json := to_jsonb(NEW);
  
  -- Ermittle Resource Name sicher über JSONB
  v_resource_name := COALESCE(
    v_new_json->>'name',
    NULLIF(CONCAT(v_new_json->>'first_name', ' ', v_new_json->>'last_name'), ' '),
    NEW.id::TEXT
  );
  
  PERFORM create_audit_log(
    'create'::audit_action_type,
    TG_TABLE_NAME,
    NEW.id,
    v_resource_name,
    NULL,
    v_new_json,
    NULL,
    NULL
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Die Trigger müssen nicht neu erstellt werden, da sie die Funktionen 