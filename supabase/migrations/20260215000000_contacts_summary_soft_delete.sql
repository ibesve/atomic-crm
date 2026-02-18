-- Migration: Füge deleted_at zur contacts_summary View hinzu
-- ============================================

-- Lösche die alte View
DROP VIEW IF EXISTS contacts_summary;

-- Erstelle die View neu mit deleted_at Spalte
CREATE VIEW contacts_summary AS
SELECT 
    co.id,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
    co.email_jsonb,
    jsonb_path_query_array(co.email_jsonb, '$[*].email')::text as email_fts,
    co.phone_jsonb,
    jsonb_path_query_array(co.phone_jsonb, '$[*].number')::text as phone_fts,
    co.background,
    co.avatar,
    co.first_seen,
    co.last_seen,
    co.has_newsletter,
    co.status,
    co.tags,
    co.company_id,
    co.sales_id,
    co.linkedin_url,
    co.deleted_at,  -- NEU: Soft Delete Support
    c.name as company_name,
    count(distinct t.id) as nb_tasks
FROM
    contacts co
LEFT JOIN
    tasks t ON co.id = t.contact_id
LEFT JOIN
    companies c ON co.company_id = c.id
GROUP BY
    co.id, c.name;

-- Grant Zugriff auf die View
GRANT SELECT ON contacts_summary TO authenticated;
GRANT SELECT ON contacts_summary TO anon;

COMMENT ON VIEW contacts_summary IS 'Kontakt-Übersicht mit Firma und Aufgabenanzahl, inkl. Soft Delete Support';
