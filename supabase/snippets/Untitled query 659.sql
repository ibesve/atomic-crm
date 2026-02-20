-- Migration: Fix Audit Triggers für Tabellen ohne 'name' Feld
-- Das Problem: Die Trigger versuchen auf NEW.name zuzugreifen, 
-- aber contacts hat nur first_name/last_name
-- ============================================

-- Funktion zum Erstellen einer neuen Version (KORRIGIERT)
CREATE OR REPLACE FUNCTION trigger_create_version_on_update()
RETURNS TRIGGER AS $$
DECLARE
  v_changed_fields TEXT[];
  v_change_summary TEXT;
  v_resource_name TEXT;
BEGIN
  -- Finde geänderte Felder
  SELECT array_agg(key) INTO v_changed_fields
  FROM (
    SELECT key
    FROM jsonb_each(to_jsonb(NEW))
    WHERE to_jsonb(NEW)->key IS DISTINCT FROM to_jsonb(OLD)->key
      AND key NOT IN ('updated_at', 'last_seen')
  ) changed;
  
  -- Nur versionieren wenn es echte Änderungen gibt
  IF v_changed_fields IS NOT NULL AND array_length(v_changed_fields, 1) > 0 THEN
    v_change_summary := 'Geänderte Felder: ' || array_to_string(v_changed_fields, ', ');
    
    -- Ermittle Resource Name sicher (ohne direkten Feldzugriff)
    v_resource_name := COALESCE(
      (to_jsonb(NEW)->>'name'),
      CONCAT(
        COALESCE((to_jsonb(NEW)->>'first_name'), ''),
        ' ',
        COALESCE((to_jsonb(NEW)->>'last_name'), '')
      ),
      NEW.id::TEXT
    );
    
    -- Erstelle Version
    PERFORM create_record_version(
      TG_TABLE_NAME,
      NEW.id,
      to_jsonb(OLD),
      v_change_summary
    );
    
    -- Erstelle Audit Log
    PERFORM create_audit_log(
      'update'::audit_action_type,
      TG_TABLE_NAME,
      NEW.id,
      TRIM(v_resource_name),
      to_jsonb(OLD),
      to_jsonb(NEW),
      v_changed_fields,
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funktion für automatisches Audit Log bei INSERT (KORRIGIERT)
CREATE OR REPLACE FUNCTION trigger_audit_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_resource_name TEXT;
BEGIN
  -- Ermittle Resource Name sicher (ohne direkten Feldzugriff)
  v_resource_name := COALESCE(
    (to_jsonb(NEW)->>'name'),
    CONCAT(
      COALESCE((to_jsonb(NEW)->>'first_name'), ''),
      ' ',
      COALESCE((to_jsonb(NEW)->>'last_name'), '')
    ),
    NEW.id::TEXT
  );

  PERFORM create_audit_log(
    'create'::audit_action_type,
    TG_TABLE_NAME,
    NEW.id,
    TRIM(v_resource_name),
    NULL,
    to_jsonb(NEW),
    NULL,
    NULL
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Kommentar
COMMENT ON FUNCTION trigger_create_version_on_update() IS 'Erstellt automatisch Versionen und Audit Logs bei Updates - unterstützt sowohl name als auch first_name/last_name';
COMMENT ON FUNCTION trigger_audit_on_insert() IS 'Erstellt automatisch Audit Logs bei Inserts - unterstützt sowohl name als auch first_name/last_name';