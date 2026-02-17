-- Migration: Soft Delete, Versioning und Audit Log
-- Erstellt: 2026-02-01

-- ============================================
-- 1. SOFT DELETE - deleted_at Spalte hinzufügen
-- ============================================

-- Contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON contacts(deleted_at);

-- Companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_deleted_at ON companies(deleted_at);

-- Deals
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_deleted_at ON deals(deleted_at);

-- Tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);

-- Contact Notes
ALTER TABLE contact_notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_notes_deleted_at ON contact_notes(deleted_at);

-- Deal Notes
ALTER TABLE deal_notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_deal_notes_deleted_at ON deal_notes(deleted_at);

-- ============================================
-- 2. AUDIT LOG Tabelle
-- ============================================

CREATE TYPE audit_action_type AS ENUM (
  'create',
  'update', 
  'delete',
  'restore',
  'export',
  'import',
  'merge',
  'bulk_delete',
  'bulk_update'
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  
  -- Wann wurde die Aktion durchgeführt
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Wer hat die Aktion durchgeführt
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_name TEXT,
  
  -- Art der Aktion
  action audit_action_type NOT NULL,
  
  -- Betroffene Resource
  resource_type TEXT NOT NULL, -- 'contacts', 'companies', 'deals', etc.
  resource_id BIGINT,
  resource_name TEXT, -- Menschenlesbare Bezeichnung (z.B. Kontaktname)
  
  -- Änderungsdetails
  old_values JSONB, -- Alte Werte vor der Änderung
  new_values JSONB, -- Neue Werte nach der Änderung
  changed_fields TEXT[], -- Liste der geänderten Felder
  
  -- Zusätzliche Metadaten
  metadata JSONB, -- Zusätzliche Informationen (z.B. Export-Format, Anzahl Datensätze)
  ip_address INET,
  user_agent TEXT,
  
  -- Für Bulk-Operationen
  batch_id UUID, -- Gruppiert zusammengehörige Operationen
  affected_count INTEGER DEFAULT 1
);

-- Indizes für performante Abfragen
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_batch_id ON audit_logs(batch_id) WHERE batch_id IS NOT NULL;

-- ============================================
-- 3. VERSIONING Tabelle
-- ============================================

CREATE TABLE IF NOT EXISTS record_versions (
  id BIGSERIAL PRIMARY KEY,
  
  -- Versionsinformationen
  version_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Wer hat die Version erstellt
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email TEXT,
  
  -- Betroffener Datensatz
  resource_type TEXT NOT NULL,
  resource_id BIGINT NOT NULL,
  
  -- Snapshot des Datensatzes
  data JSONB NOT NULL,
  
  -- Änderungsbeschreibung
  change_summary TEXT,
  
  UNIQUE(resource_type, resource_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_record_versions_resource ON record_versions(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_record_versions_created_at ON record_versions(created_at DESC);

-- ============================================
-- 4. RLS Policies für Audit Log und Versioning
-- ============================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_versions ENABLE ROW LEVEL SECURITY;

-- Audit Logs: Nur Admins können alle sehen, normale User nur ihre eigenen Aktionen
CREATE POLICY "Admins can view all audit logs" ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sales 
      WHERE sales.user_id = auth.uid() 
      AND sales.administrator = true
    )
  );

CREATE POLICY "Users can view their own audit logs" ON audit_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Nur das System kann Audit Logs erstellen (via Service Role)
CREATE POLICY "Service can insert audit logs" ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Record Versions: Alle authentifizierten User können Versionen sehen
CREATE POLICY "Authenticated users can view versions" ON record_versions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create versions" ON record_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- 5. Hilfsfunktionen für Audit Logging
-- ============================================

-- Funktion zum Erstellen eines Audit Log Eintrags
CREATE OR REPLACE FUNCTION create_audit_log(
  p_action audit_action_type,
  p_resource_type TEXT,
  p_resource_id BIGINT,
  p_resource_name TEXT DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_changed_fields TEXT[] DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_batch_id UUID DEFAULT NULL,
  p_affected_count INTEGER DEFAULT 1
) RETURNS BIGINT AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_user_name TEXT;
  v_audit_id BIGINT;
BEGIN
  -- Hole aktuelle User-Informationen
  v_user_id := auth.uid();
  
  SELECT email INTO v_user_email
  FROM auth.users WHERE id = v_user_id;
  
  SELECT CONCAT(first_name, ' ', last_name) INTO v_user_name
  FROM sales WHERE user_id = v_user_id;
  
  INSERT INTO audit_logs (
    user_id,
    user_email,
    user_name,
    action,
    resource_type,
    resource_id,
    resource_name,
    old_values,
    new_values,
    changed_fields,
    metadata,
    batch_id,
    affected_count
  ) VALUES (
    v_user_id,
    v_user_email,
    v_user_name,
    p_action,
    p_resource_type,
    p_resource_id,
    p_resource_name,
    p_old_values,
    p_new_values,
    p_changed_fields,
    p_metadata,
    p_batch_id,
    p_affected_count
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funktion zum Erstellen einer neuen Version
CREATE OR REPLACE FUNCTION create_record_version(
  p_resource_type TEXT,
  p_resource_id BIGINT,
  p_data JSONB,
  p_change_summary TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_version_number INTEGER;
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  v_user_id := auth.uid();
  
  SELECT email INTO v_user_email
  FROM auth.users WHERE id = v_user_id;
  
  -- Ermittle nächste Versionsnummer
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version_number
  FROM record_versions
  WHERE resource_type = p_resource_type AND resource_id = p_resource_id;
  
  INSERT INTO record_versions (
    version_number,
    created_by,
    created_by_email,
    resource_type,
    resource_id,
    data,
    change_summary
  ) VALUES (
    v_version_number,
    v_user_id,
    v_user_email,
    p_resource_type,
    p_resource_id,
    p_data,
    p_change_summary
  );
  
  RETURN v_version_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funktion zum Soft Delete
CREATE OR REPLACE FUNCTION soft_delete(
  p_table_name TEXT,
  p_id BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
  v_old_data JSONB;
  v_resource_name TEXT;
BEGIN
  -- Hole alte Daten für Audit Log
  EXECUTE format(
    'SELECT to_jsonb(t.*) FROM %I t WHERE id = $1',
    p_table_name
  ) INTO v_old_data USING p_id;
  
  IF v_old_data IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Ermittle Resource Name
  v_resource_name := COALESCE(
    v_old_data->>'name',
    CONCAT(v_old_data->>'first_name', ' ', v_old_data->>'last_name'),
    p_id::TEXT
  );
  
  -- Setze deleted_at
  EXECUTE format(
    'UPDATE %I SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
    p_table_name
  ) USING p_id;
  
  -- Erstelle Audit Log
  PERFORM create_audit_log(
    'delete'::audit_action_type,
    p_table_name,
    p_id,
    v_resource_name,
    v_old_data,
    NULL,
    NULL,
    NULL
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funktion zum Wiederherstellen (Restore)
CREATE OR REPLACE FUNCTION restore_deleted(
  p_table_name TEXT,
  p_id BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
  v_data JSONB;
  v_resource_name TEXT;
BEGIN
  -- Hole Daten
  EXECUTE format(
    'SELECT to_jsonb(t.*) FROM %I t WHERE id = $1 AND deleted_at IS NOT NULL',
    p_table_name
  ) INTO v_data USING p_id;
  
  IF v_data IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Ermittle Resource Name
  v_resource_name := COALESCE(
    v_data->>'name',
    CONCAT(v_data->>'first_name', ' ', v_data->>'last_name'),
    p_id::TEXT
  );
  
  -- Setze deleted_at zurück auf NULL
  EXECUTE format(
    'UPDATE %I SET deleted_at = NULL WHERE id = $1',
    p_table_name
  ) USING p_id;
  
  -- Erstelle Audit Log
  PERFORM create_audit_log(
    'restore'::audit_action_type,
    p_table_name,
    p_id,
    v_resource_name,
    v_data,
    v_data,
    ARRAY['deleted_at'],
    NULL
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. Trigger für automatisches Versioning bei Updates
-- ============================================

CREATE OR REPLACE FUNCTION trigger_create_version_on_update()
RETURNS TRIGGER AS $$
DECLARE
  v_changed_fields TEXT[];
  v_change_summary TEXT;
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
      COALESCE(
        NEW.name,
        CONCAT(NEW.first_name, ' ', NEW.last_name),
        NEW.id::TEXT
      ),
      to_jsonb(OLD),
      to_jsonb(NEW),
      v_changed_fields,
      NULL
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger für Contacts
DROP TRIGGER IF EXISTS trigger_contacts_version ON contacts;
CREATE TRIGGER trigger_contacts_version
  AFTER UPDATE ON contacts
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION trigger_create_version_on_update();

-- Trigger für Companies
DROP TRIGGER IF EXISTS trigger_companies_version ON companies;
CREATE TRIGGER trigger_companies_version
  AFTER UPDATE ON companies
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION trigger_create_version_on_update();

-- Trigger für Deals
DROP TRIGGER IF EXISTS trigger_deals_version ON deals;
CREATE TRIGGER trigger_deals_version
  AFTER UPDATE ON deals
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION trigger_create_version_on_update();

-- ============================================
-- 7. Trigger für automatisches Audit Log bei INSERT
-- ============================================

CREATE OR REPLACE FUNCTION trigger_audit_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_audit_log(
    'create'::audit_action_type,
    TG_TABLE_NAME,
    NEW.id,
    COALESCE(
      NEW.name,
      CONCAT(NEW.first_name, ' ', NEW.last_name),
      NEW.id::TEXT
    ),
    NULL,
    to_jsonb(NEW),
    NULL,
    NULL
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger für Contacts
DROP TRIGGER IF EXISTS trigger_contacts_audit_insert ON contacts;
CREATE TRIGGER trigger_contacts_audit_insert
  AFTER INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_audit_on_insert();

-- Trigger für Companies
DROP TRIGGER IF EXISTS trigger_companies_audit_insert ON companies;
CREATE TRIGGER trigger_companies_audit_insert
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_audit_on_insert();

-- Trigger für Deals
DROP TRIGGER IF EXISTS trigger_deals_audit_insert ON deals;
CREATE TRIGGER trigger_deals_audit_insert
  AFTER INSERT ON deals
  FOR EACH ROW
  EXECUTE FUNCTION trigger_audit_on_insert();

-- ============================================
-- 8. Views für einfachere Abfragen ohne gelöschte Datensätze
-- ============================================

CREATE OR REPLACE VIEW active_contacts AS
SELECT * FROM contacts WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_companies AS
SELECT * FROM companies WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_deals AS
SELECT * FROM deals WHERE deleted_at IS NULL;

-- Grant Zugriff auf die Views
GRANT SELECT ON active_contacts TO authenticated;
GRANT SELECT ON active_companies TO authenticated;
GRANT SELECT ON active_deals TO authenticated;

COMMENT ON TABLE audit_logs IS 'Protokolliert alle Änderungen an Datensätzen für Compliance und Nachvollziehbarkeit';
COMMENT ON TABLE record_versions IS 'Speichert historische Versionen von Datensätzen für Versionierung';
