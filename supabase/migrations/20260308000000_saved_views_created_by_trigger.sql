-- ============================================
-- Fix saved_views: auto-set created_by from auth.uid() on INSERT
-- ============================================
-- Problem: If the client sends NULL for created_by (e.g. identity not yet
-- loaded), the row is inserted with created_by = NULL. Then the DELETE
-- RLS policy cannot match it, causing "JSON object requested, multiple
-- (or no) rows returned" errors from PostgREST.

-- 1. Trigger function: auto-fill created_by from auth.uid() → sales.id
CREATE OR REPLACE FUNCTION public.saved_views_set_created_by()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.created_by IS NULL THEN
        NEW.created_by := (SELECT id FROM public.sales WHERE user_id = auth.uid() LIMIT 1);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach trigger to saved_views
DROP TRIGGER IF EXISTS saved_views_auto_created_by ON public.saved_views;
CREATE TRIGGER saved_views_auto_created_by
    BEFORE INSERT ON public.saved_views
    FOR EACH ROW
    EXECUTE FUNCTION public.saved_views_set_created_by();

-- 3. Fix any existing rows that have NULL created_by
-- (This is a best-effort repair — rows whose auth user is unknown stay NULL)
-- We can't retroactively know who created them, so leave them as-is.
-- But if there's only one sales user, we can assign them.
-- For safety, we'll skip this automatic repair.

-- 4. Drop and re-create the DELETE policy to also handle edge cases
-- (e.g. rows that might have been created with the wrong created_by)
DO $$ BEGIN
  DROP POLICY IF EXISTS "saved_views_delete_policy" ON "public"."saved_views";
  CREATE POLICY "saved_views_delete_policy" ON "public"."saved_views"
      FOR DELETE USING (
          auth.role() = 'authenticated'
          AND (
              created_by = (SELECT id FROM sales WHERE auth.uid() = user_id LIMIT 1)
              OR created_by IS NULL
          )
      );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
