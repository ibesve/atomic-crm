-- Migration: Task-Zuweisung und erweiterte RBAC-Policies
-- Ermöglicht Benutzern, ihre zugewiesenen Tasks und deren Kontakte zu sehen
-- auch wenn der Kontakt normalerweise nicht in ihrem RBAC-Scope liegt

-- =====================================================
-- 1. INDEX FÜR TASKS (falls noch nicht vorhanden)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_tasks_sales_id ON public.tasks(sales_id);

-- =====================================================
-- 2. HILFSFUNKTIONEN
-- =====================================================

-- Gibt alle Contact-IDs zurück, die dem aktuellen Benutzer über Tasks zugewiesen sind
CREATE OR REPLACE FUNCTION public.get_assigned_task_contact_ids()
RETURNS bigint[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT contact_id),
    ARRAY[]::bigint[]
  )
  FROM public.tasks
  WHERE sales_id = public.get_current_sales_id()
    AND done_date IS NULL  -- Nur offene Tasks
    AND (deleted_at IS NULL OR deleted_at > NOW())  -- Nicht gelöschte Tasks
$$;

-- Prüft ob ein Kontakt dem Benutzer über einen Task zugewiesen ist
CREATE OR REPLACE FUNCTION public.has_assigned_task_for_contact(p_contact_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.tasks
    WHERE contact_id = p_contact_id
      AND sales_id = public.get_current_sales_id()
      AND done_date IS NULL
      AND (deleted_at IS NULL OR deleted_at > NOW())
  )
$$;

-- =====================================================
-- 3. ERWEITERTE CONTACTS RLS POLICY
-- =====================================================

-- Lösche alte Policy und erstelle neue mit Task-Zuweisung
DROP POLICY IF EXISTS "Contacts read with RBAC" ON "public"."contacts";
CREATE POLICY "Contacts read with RBAC" ON "public"."contacts"
  FOR SELECT TO authenticated
  USING (
    public.is_admin() 
    OR public.has_record_access('contacts', 'list', sales_id)
    -- NEU: Auch sichtbar wenn dem Benutzer ein Task für diesen Kontakt zugewiesen ist
    OR public.has_assigned_task_for_contact(id)
  );

-- =====================================================
-- 4. TASKS RLS POLICIES MIT RBAC
-- =====================================================

-- Lösche alle alten Task-Policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."tasks";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."tasks";
DROP POLICY IF EXISTS "Task Delete Policy" ON "public"."tasks";
DROP POLICY IF EXISTS "Task Update Policy" ON "public"."tasks";
DROP POLICY IF EXISTS "Tasks read with RBAC" ON "public"."tasks";
DROP POLICY IF EXISTS "Tasks insert with RBAC" ON "public"."tasks";
DROP POLICY IF EXISTS "Tasks update with RBAC" ON "public"."tasks";
DROP POLICY IF EXISTS "Tasks delete with RBAC" ON "public"."tasks";

-- Tasks lesen: Eigene zugewiesene Tasks ODER Tasks basierend auf Kontakt-Zugriff
CREATE POLICY "Tasks read with RBAC" ON "public"."tasks"
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    -- Zugewiesene Tasks kann man immer sehen
    OR sales_id = public.get_current_sales_id()
    -- Tasks von Kontakten im eigenen RBAC-Scope
    OR EXISTS (
      SELECT 1 FROM public.contacts c 
      WHERE c.id = contact_id 
      AND public.has_record_access('contacts', 'list', c.sales_id)
    )
  );

-- Tasks erstellen: Basierend auf Kontakt-Zugriff oder eigene Zuweisung
CREATE POLICY "Tasks insert with RBAC" ON "public"."tasks"
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.check_permission('tasks', 'create') IN ('all', 'own', 'team')
  );

-- Tasks aktualisieren: Nur eigene zugewiesene oder Tasks von Kontakten im Scope
CREATE POLICY "Tasks update with RBAC" ON "public"."tasks"
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    -- Eigene zugewiesene Tasks
    OR sales_id = public.get_current_sales_id()
    -- Tasks von Kontakten im eigenen RBAC-Scope
    OR EXISTS (
      SELECT 1 FROM public.contacts c 
      WHERE c.id = contact_id 
      AND public.has_record_access('contacts', 'edit', c.sales_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR sales_id = public.get_current_sales_id()
    OR EXISTS (
      SELECT 1 FROM public.contacts c 
      WHERE c.id = contact_id 
      AND public.has_record_access('contacts', 'edit', c.sales_id)
    )
  );

-- Tasks löschen: Nur eigene zugewiesene oder Tasks von Kontakten im Scope
CREATE POLICY "Tasks delete with RBAC" ON "public"."tasks"
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR sales_id = public.get_current_sales_id()
    OR EXISTS (
      SELECT 1 FROM public.contacts c 
      WHERE c.id = contact_id 
      AND public.has_record_access('contacts', 'delete', c.sales_id)
    )
  );

-- =====================================================
-- 5. VIEW FÜR BENUTZER-TASKS MIT KONTAKTINFO
-- =====================================================

DROP VIEW IF EXISTS public.my_assigned_tasks;
CREATE VIEW public.my_assigned_tasks
WITH (security_invoker=on)
AS
SELECT 
  t.id,
  t.contact_id,
  t.type,
  t.text,
  t.due_date,
  t.done_date,
  t.sales_id,
  t.deleted_at,
  c.first_name as contact_first_name,
  c.last_name as contact_last_name,
  c.email_jsonb as contact_emails,
  c.company_id,
  comp.name as company_name
FROM public.tasks t
LEFT JOIN public.contacts c ON t.contact_id = c.id
LEFT JOIN public.companies comp ON c.company_id = comp.id
WHERE t.sales_id = public.get_current_sales_id()
  AND t.done_date IS NULL
  AND (t.deleted_at IS NULL OR t.deleted_at > NOW())
ORDER BY t.due_date ASC;

-- =====================================================
-- 6. KOMMENTARE ZUR DOKUMENTATION
-- =====================================================

COMMENT ON FUNCTION public.get_assigned_task_contact_ids() IS 'Gibt alle Contact-IDs zurück, für die dem aktuellen Benutzer offene Tasks zugewiesen sind.';

COMMENT ON FUNCTION public.has_assigned_task_for_contact(bigint) IS 'Prüft ob dem aktuellen Benutzer ein offener Task für den angegebenen Kontakt zugewiesen ist.';

COMMENT ON VIEW public.my_assigned_tasks IS 'Zeigt alle dem aktuellen Benutzer zugewiesenen offenen Tasks mit Kontakt- und Firmeninformationen.';
