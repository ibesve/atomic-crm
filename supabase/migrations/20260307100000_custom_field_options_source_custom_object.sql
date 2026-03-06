-- ============================================
-- Migration: Allow 'custom_object' as options_source value
-- Date: 2026-03-07
-- ============================================

-- Drop the old constraint and recreate with the additional value
ALTER TABLE "public"."custom_field_definitions"
    DROP CONSTRAINT IF EXISTS "custom_field_definitions_options_source_check";

ALTER TABLE "public"."custom_field_definitions"
    ADD CONSTRAINT "custom_field_definitions_options_source_check"
    CHECK (options_source IN ('static', 'table', 'view', 'custom_object'));
