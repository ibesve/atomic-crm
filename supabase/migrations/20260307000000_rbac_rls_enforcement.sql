-- ============================================================================
-- Migration: RBAC RLS Enforcement
-- Date: 2026-03-07
-- Purpose: Replace all USING(true) policies with scope-aware RLS policies
--          that respect role_permissions.scope (all/own/team/none)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Helper Functions
-- ────────────────────────────────────────────────────────────────────────────

-- Get the sales.id for the current authenticated user
CREATE OR REPLACE FUNCTION public.get_current_sales_id()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.sales WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Check if the current user is an admin (via sales.administrator OR admin role)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sales WHERE user_id = auth.uid() AND administrator = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.sales_id = public.get_current_sales_id()
      AND r.name = 'admin'
  );
$$;

-- Get the highest scope for a given resource (returns 'all', 'team', 'own', 'none')
-- Checks both direct user_roles and team_roles
CREATE OR REPLACE FUNCTION public.get_user_scope(p_resource text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT
        CASE
          WHEN bool_or(rp.scope = 'all') THEN 'all'
          WHEN bool_or(rp.scope = 'team') THEN 'team'
          WHEN bool_or(rp.scope = 'own') THEN 'own'
          ELSE 'none'
        END
      FROM public.role_permissions rp
      WHERE rp.resource IN (p_resource, '*')
        AND rp.action IN ('list', '*')
        AND rp.role_id IN (
          -- Direct user roles
          SELECT ur.role_id FROM public.user_roles ur
          WHERE ur.sales_id = public.get_current_sales_id()
          UNION
          -- Team roles (inherited by team membership)
          SELECT tr.role_id FROM public.team_roles tr
          JOIN public.team_members tm ON tm.team_id = tr.team_id
          WHERE tm.sales_id = public.get_current_sales_id()
        )
    ),
    'own'  -- Default: users can see their own records
  );
$$;

-- Get all sales_ids in the same team(s) as the current user
-- Includes the user themselves and, for team leaders, all members
CREATE OR REPLACE FUNCTION public.get_team_member_ids()
RETURNS bigint[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT tm2.sales_id),
    ARRAY[public.get_current_sales_id()]
  )
  FROM public.team_members tm1
  JOIN public.team_members tm2 ON tm2.team_id = tm1.team_id
  WHERE tm1.sales_id = public.get_current_sales_id();
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Generic scope-check function for tables with sales_id column
--    Returns TRUE if the current user may see the given record
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_scope(p_resource text, p_sales_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN public.is_admin() THEN true
      WHEN public.get_user_scope(p_resource) = 'all' THEN true
      WHEN public.get_user_scope(p_resource) = 'team' THEN
        p_sales_id = ANY(public.get_team_member_ids())
        OR p_sales_id IS NULL  -- unassigned records visible to team scope
      WHEN public.get_user_scope(p_resource) = 'own' THEN
        p_sales_id = public.get_current_sales_id()
        OR p_sales_id IS NULL  -- unassigned records visible to own scope
      ELSE false
    END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Drop all old permissive policies on core data tables
-- ────────────────────────────────────────────────────────────────────────────

-- contacts
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."contacts";
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."contacts";
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."contacts";
DROP POLICY IF EXISTS "Contact Delete Policy" ON "public"."contacts";

-- companies
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."companies";
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."companies";
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."companies";
DROP POLICY IF EXISTS "Company Delete Policy" ON "public"."companies";

-- deals
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."deals";
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."deals";
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."deals";
DROP POLICY IF EXISTS "Deals Delete Policy" ON "public"."deals";

-- tasks
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."tasks";
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."tasks";
DROP POLICY IF EXISTS "Task Update Policy" ON "public"."tasks";
DROP POLICY IF EXISTS "Task Delete Policy" ON "public"."tasks";

-- contact_notes (renamed from contactNotes)
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."contact_notes";
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."contact_notes";
DROP POLICY IF EXISTS "Contact Notes Delete Policy" ON "public"."contact_notes";
DROP POLICY IF EXISTS "Contact Notes Update policy" ON "public"."contact_notes";
-- Old names (pre-rename, just in case)
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."contactNotes";
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."contactNotes";
DROP POLICY IF EXISTS "Contact Notes Delete Policy" ON "public"."contactNotes";
DROP POLICY IF EXISTS "Contact Notes Update policy" ON "public"."contactNotes";

-- deal_notes (renamed from dealNotes)
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."deal_notes";
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."deal_notes";
DROP POLICY IF EXISTS "Deal Notes Delete Policy" ON "public"."deal_notes";
DROP POLICY IF EXISTS "Deal Notes Update Policy" ON "public"."deal_notes";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."dealNotes";
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."dealNotes";
DROP POLICY IF EXISTS "Deal Notes Delete Policy" ON "public"."dealNotes";
DROP POLICY IF EXISTS "Deal Notes Update Policy" ON "public"."dealNotes";

-- sales (admin-managed)
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."sales";
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."sales";
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."sales";

-- tags
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."tags";
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."tags";
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON "public"."tags";
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."tags";
DROP POLICY IF EXISTS "tags write policy" ON "public"."tags";

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Create new scope-aware RLS policies
-- ────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════
-- CONTACTS (has sales_id)
-- ═══════════════════════════════════════════

CREATE POLICY "rbac_contacts_select" ON "public"."contacts"
  FOR SELECT TO authenticated
  USING (public.check_scope('contacts', sales_id));

CREATE POLICY "rbac_contacts_insert" ON "public"."contacts"
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "rbac_contacts_update" ON "public"."contacts"
  FOR UPDATE TO authenticated
  USING (public.check_scope('contacts', sales_id))
  WITH CHECK (public.check_scope('contacts', sales_id));

CREATE POLICY "rbac_contacts_delete" ON "public"."contacts"
  FOR DELETE TO authenticated
  USING (public.check_scope('contacts', sales_id));

-- ═══════════════════════════════════════════
-- COMPANIES (has sales_id)
-- ═══════════════════════════════════════════

CREATE POLICY "rbac_companies_select" ON "public"."companies"
  FOR SELECT TO authenticated
  USING (public.check_scope('companies', sales_id));

CREATE POLICY "rbac_companies_insert" ON "public"."companies"
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "rbac_companies_update" ON "public"."companies"
  FOR UPDATE TO authenticated
  USING (public.check_scope('companies', sales_id))
  WITH CHECK (public.check_scope('companies', sales_id));

CREATE POLICY "rbac_companies_delete" ON "public"."companies"
  FOR DELETE TO authenticated
  USING (public.check_scope('companies', sales_id));

-- ═══════════════════════════════════════════
-- DEALS (has sales_id)
-- ═══════════════════════════════════════════

CREATE POLICY "rbac_deals_select" ON "public"."deals"
  FOR SELECT TO authenticated
  USING (public.check_scope('deals', sales_id));

CREATE POLICY "rbac_deals_insert" ON "public"."deals"
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "rbac_deals_update" ON "public"."deals"
  FOR UPDATE TO authenticated
  USING (public.check_scope('deals', sales_id))
  WITH CHECK (public.check_scope('deals', sales_id));

CREATE POLICY "rbac_deals_delete" ON "public"."deals"
  FOR DELETE TO authenticated
  USING (public.check_scope('deals', sales_id));

-- ═══════════════════════════════════════════
-- TASKS (has sales_id)
-- ═══════════════════════════════════════════

CREATE POLICY "rbac_tasks_select" ON "public"."tasks"
  FOR SELECT TO authenticated
  USING (public.check_scope('tasks', sales_id));

CREATE POLICY "rbac_tasks_insert" ON "public"."tasks"
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "rbac_tasks_update" ON "public"."tasks"
  FOR UPDATE TO authenticated
  USING (public.check_scope('tasks', sales_id))
  WITH CHECK (public.check_scope('tasks', sales_id));

CREATE POLICY "rbac_tasks_delete" ON "public"."tasks"
  FOR DELETE TO authenticated
  USING (public.check_scope('tasks', sales_id));

-- ═══════════════════════════════════════════
-- CONTACT_NOTES (linked via contact → sales_id)
-- Notes inherit scope from their parent contact
-- ═══════════════════════════════════════════

CREATE POLICY "rbac_contact_notes_select" ON "public"."contact_notes"
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_notes.contact_id
        AND public.check_scope('contacts', c.sales_id)
    )
  );

CREATE POLICY "rbac_contact_notes_insert" ON "public"."contact_notes"
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "rbac_contact_notes_update" ON "public"."contact_notes"
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_notes.contact_id
        AND public.check_scope('contacts', c.sales_id)
    )
  );

CREATE POLICY "rbac_contact_notes_delete" ON "public"."contact_notes"
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = contact_notes.contact_id
        AND public.check_scope('contacts', c.sales_id)
    )
  );

-- ═══════════════════════════════════════════
-- DEAL_NOTES (linked via deal → sales_id)
-- ═══════════════════════════════════════════

CREATE POLICY "rbac_deal_notes_select" ON "public"."deal_notes"
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_notes.deal_id
        AND public.check_scope('deals', d.sales_id)
    )
  );

CREATE POLICY "rbac_deal_notes_insert" ON "public"."deal_notes"
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "rbac_deal_notes_update" ON "public"."deal_notes"
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_notes.deal_id
        AND public.check_scope('deals', d.sales_id)
    )
  );

CREATE POLICY "rbac_deal_notes_delete" ON "public"."deal_notes"
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_notes.deal_id
        AND public.check_scope('deals', d.sales_id)
    )
  );

-- ═══════════════════════════════════════════
-- SALES (read by everyone, write by admin only)
-- ═══════════════════════════════════════════

CREATE POLICY "rbac_sales_select" ON "public"."sales"
  FOR SELECT TO authenticated
  USING (true);  -- Everyone needs to see sales for dropdowns/references

CREATE POLICY "rbac_sales_insert" ON "public"."sales"
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "rbac_sales_update" ON "public"."sales"
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()  -- Users can update their own profile
  )
  WITH CHECK (
    public.is_admin()
    OR user_id = auth.uid()
  );

-- ═══════════════════════════════════════════
-- TAGS (shared resource, everyone can read/write)
-- ═══════════════════════════════════════════

CREATE POLICY "rbac_tags_select" ON "public"."tags"
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "rbac_tags_insert" ON "public"."tags"
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "rbac_tags_update" ON "public"."tags"
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "rbac_tags_delete" ON "public"."tags"
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Seed default roles and permissions
-- ────────────────────────────────────────────────────────────────────────────

-- Insert default roles (idempotent via ON CONFLICT)
INSERT INTO public.roles (name, description) VALUES
  ('admin', 'Full system access — all resources, all scopes'),
  ('sales_director', 'Can view and manage all records across all teams'),
  ('supervisor', 'Can manage records for their own team'),
  ('sales_rep', 'Can only manage their own records')
ON CONFLICT DO NOTHING;

-- Admin role permissions: wildcard access, scope 'all'
INSERT INTO public.role_permissions (role_id, resource, action, scope)
SELECT r.id, '*', '*', 'all'
FROM public.roles r WHERE r.name = 'admin'
AND NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_id = r.id AND rp.resource = '*' AND rp.action = '*'
);

-- Sales Director: scope 'all' for CRM resources
INSERT INTO public.role_permissions (role_id, resource, action, scope)
SELECT r.id, res.resource, '*', 'all'
FROM public.roles r,
     (VALUES ('contacts'), ('companies'), ('deals'), ('tasks'),
             ('contact_notes'), ('deal_notes'), ('tags'),
             ('custom_field_values'), ('custom_object_data')) AS res(resource)
WHERE r.name = 'sales_director'
AND NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_id = r.id AND rp.resource = res.resource
);

-- Supervisor: scope 'team' for CRM resources
INSERT INTO public.role_permissions (role_id, resource, action, scope)
SELECT r.id, res.resource, '*', 'team'
FROM public.roles r,
     (VALUES ('contacts'), ('companies'), ('deals'), ('tasks'),
             ('contact_notes'), ('deal_notes'), ('tags'),
             ('custom_field_values'), ('custom_object_data')) AS res(resource)
WHERE r.name = 'supervisor'
AND NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_id = r.id AND rp.resource = res.resource
);

-- Sales Rep: scope 'own' for CRM resources
INSERT INTO public.role_permissions (role_id, resource, action, scope)
SELECT r.id, res.resource, '*', 'own'
FROM public.roles r,
     (VALUES ('contacts'), ('companies'), ('deals'), ('tasks'),
             ('contact_notes'), ('deal_notes'), ('tags'),
             ('custom_field_values'), ('custom_object_data')) AS res(resource)
WHERE r.name = 'sales_rep'
AND NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_id = r.id AND rp.resource = res.resource
);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Assign admin role to all existing administrator users
--    Only runs when user_roles is empty (first-time setup).
--    After initial seed, roles are managed via the admin UI.
-- ────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1) THEN
    INSERT INTO public.user_roles (sales_id, role_id)
    SELECT s.id, r.id
    FROM public.sales s, public.roles r
    WHERE s.administrator = true AND r.name = 'admin'
    ON CONFLICT (sales_id, role_id) DO NOTHING;

    -- Assign sales_rep role to all non-admin users as default
    INSERT INTO public.user_roles (sales_id, role_id)
    SELECT s.id, r.id
    FROM public.sales s, public.roles r
    WHERE (s.administrator IS NULL OR s.administrator = false) AND r.name = 'sales_rep'
    ON CONFLICT (sales_id, role_id) DO NOTHING;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Performance indexes
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_contacts_sales_id ON public.contacts(sales_id);
CREATE INDEX IF NOT EXISTS idx_companies_sales_id ON public.companies(sales_id);
CREATE INDEX IF NOT EXISTS idx_deals_sales_id ON public.deals(sales_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sales_id ON public.tasks(sales_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON public.sales(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_resource ON public.role_permissions(role_id, resource);

-- ────────────────────────────────────────────────────────────────────────────
-- 8. Grant execute on helper functions to authenticated role
-- ────────────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.get_current_sales_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_scope(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_member_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_scope(text, bigint) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. Expose helper functions via PostgREST (RPC)
--    Frontend can call: POST /rest/v1/rpc/get_user_scope { "p_resource": "contacts" }
-- ────────────────────────────────────────────────────────────────────────────

COMMENT ON FUNCTION public.get_current_sales_id() IS 'Returns the sales.id for the current authenticated user';
COMMENT ON FUNCTION public.is_admin() IS 'Returns true if the current user is an admin';
COMMENT ON FUNCTION public.get_user_scope(text) IS 'Returns the effective scope (all/team/own/none) for a resource';
COMMENT ON FUNCTION public.get_team_member_ids() IS 'Returns array of sales_ids in the current users teams';
