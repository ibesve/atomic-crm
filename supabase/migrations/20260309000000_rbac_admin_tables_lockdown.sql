-- ============================================================================
-- Migration: Lock down RBAC/admin tables to admin-only writes
-- ============================================================================
-- Fixes critical security finding: roles, role_permissions, teams,
-- team_members, user_roles, team_roles, attribute_definitions,
-- user_attributes, permission_conditions all had FOR ALL policies with
-- auth.role() = 'authenticated', allowing ANY logged-in user to modify
-- them (including privilege escalation via user_roles).
--
-- Fix: Keep SELECT open for all authenticated users (needed for UI),
-- replace the ALL modify policies with admin-only INSERT/UPDATE/DELETE.
--
-- Also fixes: saved_views GRANT ALL TO anon → revoke write access from anon.
-- ============================================================================

BEGIN;

-- ── Helper: idempotent policy drop ──────────────────────────────────────────
-- (Some policies may already have been dropped in a prior run.)
DO $$ BEGIN

-- ─── 1. roles ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS roles_modify_policy ON public.roles;

-- ─── 2. role_permissions ────────────────────────────────────────────────────
DROP POLICY IF EXISTS role_permissions_modify_policy ON public.role_permissions;

-- ─── 3. teams ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS teams_modify_policy ON public.teams;

-- ─── 4. team_members ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS team_members_modify_policy ON public.team_members;

-- ─── 5. user_roles ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS user_roles_modify_policy ON public.user_roles;

-- ─── 6. team_roles ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS team_roles_modify_policy ON public.team_roles;

-- ─── 7. attribute_definitions ───────────────────────────────────────────────
DROP POLICY IF EXISTS attribute_definitions_modify_policy ON public.attribute_definitions;

-- ─── 8. user_attributes ────────────────────────────────────────────────────
DROP POLICY IF EXISTS user_attributes_modify_policy ON public.user_attributes;

-- ─── 9. permission_conditions ──────────────────────────────────────────────
DROP POLICY IF EXISTS permission_conditions_modify_policy ON public.permission_conditions;

END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- CREATE NEW ADMIN-ONLY WRITE POLICIES
-- SELECT policies remain unchanged (auth.role() = 'authenticated').
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. roles ───────────────────────────────────────────────────────────────
CREATE POLICY roles_insert_admin ON public.roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY roles_update_admin ON public.roles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY roles_delete_admin ON public.roles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ─── 2. role_permissions ────────────────────────────────────────────────────
CREATE POLICY role_permissions_insert_admin ON public.role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY role_permissions_update_admin ON public.role_permissions
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY role_permissions_delete_admin ON public.role_permissions
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ─── 3. teams ───────────────────────────────────────────────────────────────
CREATE POLICY teams_insert_admin ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY teams_update_admin ON public.teams
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY teams_delete_admin ON public.teams
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ─── 4. team_members ────────────────────────────────────────────────────────
CREATE POLICY team_members_insert_admin ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY team_members_update_admin ON public.team_members
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY team_members_delete_admin ON public.team_members
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ─── 5. user_roles ──────────────────────────────────────────────────────────
CREATE POLICY user_roles_insert_admin ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY user_roles_update_admin ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY user_roles_delete_admin ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ─── 6. team_roles ──────────────────────────────────────────────────────────
CREATE POLICY team_roles_insert_admin ON public.team_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY team_roles_update_admin ON public.team_roles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY team_roles_delete_admin ON public.team_roles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ─── 7. attribute_definitions ───────────────────────────────────────────────
CREATE POLICY attribute_definitions_insert_admin ON public.attribute_definitions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY attribute_definitions_update_admin ON public.attribute_definitions
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY attribute_definitions_delete_admin ON public.attribute_definitions
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ─── 8. user_attributes ────────────────────────────────────────────────────
CREATE POLICY user_attributes_insert_admin ON public.user_attributes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY user_attributes_update_admin ON public.user_attributes
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY user_attributes_delete_admin ON public.user_attributes
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ─── 9. permission_conditions ──────────────────────────────────────────────
CREATE POLICY permission_conditions_insert_admin ON public.permission_conditions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY permission_conditions_update_admin ON public.permission_conditions
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY permission_conditions_delete_admin ON public.permission_conditions
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: saved_views — revoke anon write access
-- ═══════════════════════════════════════════════════════════════════════════
-- The anon role should only be able to SELECT shared views (if at all).
-- RLS policies already restrict reads to own + shared, so GRANT SELECT is safe.
REVOKE INSERT, UPDATE, DELETE ON public.saved_views FROM anon;
REVOKE USAGE ON SEQUENCE saved_views_id_seq FROM anon;
-- Keep SELECT + sequence SELECT for anon (read-only)
GRANT SELECT ON public.saved_views TO anon;
GRANT SELECT ON SEQUENCE saved_views_id_seq TO anon;


-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: audit_logs — restrict INSERT to actual user's own entries
-- ═══════════════════════════════════════════════════════════════════════════
-- Currently any user can insert arbitrary audit log entries (WITH CHECK true).
-- Replace with: you can only insert logs for your own user_id.
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert_own ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

COMMIT;
