-- Migration: RBAC System - Aktualisierung der Funktionen und Policies
-- Diese Migration aktualisiert nur die Funktionen und RLS Policies
-- RESTRIKTIVE VERSION: Ohne Rolle = kein Zugriff

-- =====================================================
-- HILFSFUNKTIONEN (CREATE OR REPLACE ist idempotent)
-- =====================================================

-- Aktuellen Sales-Benutzer ermitteln
CREATE OR REPLACE FUNCTION public.get_current_sales_id()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM public.sales WHERE user_id = auth.uid()
$$;

-- Prüfen ob aktueller Benutzer Admin ist
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT administrator FROM public.sales WHERE user_id = auth.uid()),
    false
  )
$$;

-- Berechtigung für Ressource und Aktion prüfen - gibt Scope zurück
-- RESTRIKTIV: Ohne Rolle = 'none' (kein Zugriff)
CREATE OR REPLACE FUNCTION public.check_permission(
  p_resource text,
  p_action text
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    CASE 
      -- Admins haben immer vollen Zugriff
      WHEN public.is_admin() THEN 'all'
      -- Prüfe ob Benutzer eine Rolle hat und diese die Berechtigung enthält
      ELSE COALESCE(
        (
          SELECT rp.scope
          FROM public.sales s
          JOIN public.role_permissions rp ON rp.role_id = s.role_id
          WHERE s.user_id = auth.uid()
            AND rp.resource = p_resource
            AND rp.action = p_action
        ),
        'none' -- KEINE Rolle oder keine Berechtigung = kein Zugriff
      )
    END
$$;

-- Team-Mitglieder IDs ermitteln (alle Benutzer im selben Team)
CREATE OR REPLACE FUNCTION public.get_team_member_ids()
RETURNS bigint[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT tm2.sales_id),
    ARRAY[public.get_current_sales_id()] -- Mindestens sich selbst
  )
  FROM public.team_members tm1
  JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
  WHERE tm1.sales_id = public.get_current_sales_id()
$$;

-- KERNFUNKTION: Prüfen ob Benutzer Zugriff auf einen Datensatz hat
-- RESTRIKTIV: 
-- - 'none' = nur Admin
-- - 'own' = nur eigene Datensätze (sales_id muss übereinstimmen)
-- - 'team' = eigene + Team-Datensätze
-- - 'all' = alle Datensätze
CREATE OR REPLACE FUNCTION public.has_record_access(
  p_resource text,
  p_action text,
  p_sales_id bigint
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT CASE public.check_permission(p_resource, p_action)
    WHEN 'all' THEN true
    WHEN 'own' THEN (
      -- Nur eigene Datensätze - sales_id MUSS übereinstimmen
      p_sales_id IS NOT NULL 
      AND p_sales_id = public.get_current_sales_id()
    )
    WHEN 'team' THEN (
      -- Eigene + Team-Datensätze
      p_sales_id IS NOT NULL 
      AND (
        p_sales_id = public.get_current_sales_id()
        OR p_sales_id = ANY(public.get_team_member_ids())
      )
    )
    WHEN 'none' THEN false -- Kein Zugriff (nur Admin über is_admin())
    ELSE false -- Fallback: Kein Zugriff
  END
$$;

-- =====================================================
-- RLS POLICIES FÜR RBAC-TABELLEN
-- =====================================================

-- Roles: Lesen für alle, Schreiben nur für Admins
DROP POLICY IF EXISTS "Roles read for authenticated" ON "public"."roles";
CREATE POLICY "Roles read for authenticated" ON "public"."roles"
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Roles write for admins" ON "public"."roles";
CREATE POLICY "Roles write for admins" ON "public"."roles"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Role Permissions: Lesen für alle, Schreiben nur für Admins
DROP POLICY IF EXISTS "Role permissions read for authenticated" ON "public"."role_permissions";
CREATE POLICY "Role permissions read for authenticated" ON "public"."role_permissions"
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Role permissions write for admins" ON "public"."role_permissions";
CREATE POLICY "Role permissions write for admins" ON "public"."role_permissions"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Teams: Lesen für alle, Schreiben nur für Admins
DROP POLICY IF EXISTS "Teams read for authenticated" ON "public"."teams";
CREATE POLICY "Teams read for authenticated" ON "public"."teams"
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Teams write for admins" ON "public"."teams";
CREATE POLICY "Teams write for admins" ON "public"."teams"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Team Members: Lesen für alle, Schreiben nur für Admins
DROP POLICY IF EXISTS "Team members read for authenticated" ON "public"."team_members";
CREATE POLICY "Team members read for authenticated" ON "public"."team_members"
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Team members write for admins" ON "public"."team_members";
CREATE POLICY "Team members write for admins" ON "public"."team_members"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =====================================================
-- RLS POLICIES FÜR CONTACTS MIT RBAC
-- =====================================================

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."contacts";
DROP POLICY IF EXISTS "Contacts read with RBAC" ON "public"."contacts";
CREATE POLICY "Contacts read with RBAC" ON "public"."contacts"
  FOR SELECT TO authenticated
  USING (
    public.is_admin() 
    OR public.has_record_access('contacts', 'list', sales_id)
  );

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."contacts";
DROP POLICY IF EXISTS "Contacts insert with RBAC" ON "public"."contacts";
CREATE POLICY "Contacts insert with RBAC" ON "public"."contacts"
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.check_permission('contacts', 'create') IN ('all', 'own', 'team')
  );

DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."contacts";
DROP POLICY IF EXISTS "Contacts update with RBAC" ON "public"."contacts";
CREATE POLICY "Contacts update with RBAC" ON "public"."contacts"
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.has_record_access('contacts', 'edit', sales_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_record_access('contacts', 'edit', sales_id)
  );

DROP POLICY IF EXISTS "Contact Delete Policy" ON "public"."contacts";
DROP POLICY IF EXISTS "Contacts delete with RBAC" ON "public"."contacts";
CREATE POLICY "Contacts delete with RBAC" ON "public"."contacts"
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.has_record_access('contacts', 'delete', sales_id)
  );

-- =====================================================
-- RLS POLICIES FÜR COMPANIES MIT RBAC
-- =====================================================

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."companies";
DROP POLICY IF EXISTS "Companies read with RBAC" ON "public"."companies";
CREATE POLICY "Companies read with RBAC" ON "public"."companies"
  FOR SELECT TO authenticated
  USING (
    public.is_admin() 
    OR public.has_record_access('companies', 'list', sales_id)
  );

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."companies";
DROP POLICY IF EXISTS "Companies insert with RBAC" ON "public"."companies";
CREATE POLICY "Companies insert with RBAC" ON "public"."companies"
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.check_permission('companies', 'create') IN ('all', 'own', 'team')
  );

DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."companies";
DROP POLICY IF EXISTS "Companies update with RBAC" ON "public"."companies";
CREATE POLICY "Companies update with RBAC" ON "public"."companies"
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.has_record_access('companies', 'edit', sales_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_record_access('companies', 'edit', sales_id)
  );

DROP POLICY IF EXISTS "Company Delete Policy" ON "public"."companies";
DROP POLICY IF EXISTS "Companies delete with RBAC" ON "public"."companies";
CREATE POLICY "Companies delete with RBAC" ON "public"."companies"
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.has_record_access('companies', 'delete', sales_id)
  );

-- =====================================================
-- RLS POLICIES FÜR DEALS MIT RBAC
-- =====================================================

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."deals";
DROP POLICY IF EXISTS "Deals read with RBAC" ON "public"."deals";
CREATE POLICY "Deals read with RBAC" ON "public"."deals"
  FOR SELECT TO authenticated
  USING (
    public.is_admin() 
    OR public.has_record_access('deals', 'list', sales_id)
  );

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."deals";
DROP POLICY IF EXISTS "Deals insert with RBAC" ON "public"."deals";
CREATE POLICY "Deals insert with RBAC" ON "public"."deals"
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.check_permission('deals', 'create') IN ('all', 'own', 'team')
  );

DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."deals";
DROP POLICY IF EXISTS "Deals update with RBAC" ON "public"."deals";
CREATE POLICY "Deals update with RBAC" ON "public"."deals"
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.has_record_access('deals', 'edit', sales_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_record_access('deals', 'edit', sales_id)
  );

DROP POLICY IF EXISTS "Deals Delete Policy" ON "public"."deals";
DROP POLICY IF EXISTS "Deals delete with RBAC" ON "public"."deals";
CREATE POLICY "Deals delete with RBAC" ON "public"."deals"
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.has_record_access('deals', 'delete', sales_id)
  );

-- =====================================================
-- GRANTS (idempotent)
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."roles" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."role_permissions" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."teams" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."team_members" TO "authenticated";

-- =====================================================
-- VIEW FÜR BERECHTIGUNGSÜBERSICHT
-- =====================================================

DROP VIEW IF EXISTS "public"."user_permissions";
CREATE VIEW "public"."user_permissions"
WITH (security_invoker=on)
AS
SELECT 
  s.id as sales_id,
  s.first_name,
  s.last_name,
  s.administrator,
  r.name as role_name,
  rp.resource,
  rp.action,
  rp.scope
FROM public.sales s
LEFT JOIN public.roles r ON s.role_id = r.id
LEFT JOIN public.role_permissions rp ON r.id = rp.role_id
WHERE s.user_id = auth.uid();
