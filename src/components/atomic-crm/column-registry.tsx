/**
 * Column Registry — defines built-in columns for each entity type.
 * Used by GenericDataGrid to render appropriate columns for contacts, companies, deals.
 * Custom object columns are generated dynamically from custom_field_definitions.
 */
import { Link } from "react-router";
import { ExternalLink } from "lucide-react";
import type { EditableColumnDef } from "@/components/admin/editable-datagrid";
import type { Contact, Company, Deal, Sale } from "./types";
import type { LabeledValue, DealStage } from "./types";

// ── Helpers ──────────────────────────────────────────────────

const getFirstEmail = (emailJsonb: any): string => {
  if (!emailJsonb || !Array.isArray(emailJsonb) || emailJsonb.length === 0) return "-";
  return emailJsonb[0]?.email || "-";
};

const getFirstPhone = (phoneJsonb: any): string => {
  if (!phoneJsonb || !Array.isArray(phoneJsonb) || phoneJsonb.length === 0) return "-";
  return phoneJsonb[0]?.number || "-";
};

// ── Reference data types ─────────────────────────────────────

export interface ColumnRegistryReferenceData {
  companies?: Company[];
  sales?: Sale[];
  companySectors?: LabeledValue[];
  dealCategories?: LabeledValue[];
  dealStages?: DealStage[];
  companySizes?: { id: number; name: string }[];
}

// ── Contact Columns ──────────────────────────────────────────

function getContactColumns(
  t: (key: string, options?: Record<string, string>) => string,
  refs: ColumnRegistryReferenceData,
): EditableColumnDef<Contact>[] {
  const { companies = [], sales = [] } = refs;
  return [
    {
      source: "first_name",
      label: t("resources.contacts.fields.first_name"),
      editable: true,
      type: "text",
      sortable: true,
    },
    {
      source: "last_name",
      label: t("resources.contacts.fields.last_name"),
      editable: true,
      type: "text",
      sortable: true,
      render: (record) => (
        <Link
          to={`/contacts/${record.id}/show`}
          className="text-primary hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {record.last_name || "-"}
        </Link>
      ),
    },
    {
      source: "email_jsonb",
      label: t("resources.contacts.fields.email"),
      editable: true,
      type: "text",
      sortable: false,
      render: (record) => getFirstEmail(record.email_jsonb),
      getEditValue: (record: Contact) => {
        if (!record.email_jsonb || !Array.isArray(record.email_jsonb) || record.email_jsonb.length === 0) return "";
        return record.email_jsonb[0]?.email || "";
      },
      transformValue: (value: unknown, record: Contact) => {
        const emailStr = value as string;
        const existing = record.email_jsonb && Array.isArray(record.email_jsonb) ? [...record.email_jsonb] : [];
        if (existing.length === 0) {
          if (!emailStr) return { email_jsonb: [] };
          return { email_jsonb: [{ email: emailStr, type: "Work" }] };
        }
        existing[0] = { ...existing[0], email: emailStr };
        return { email_jsonb: existing };
      },
    },
    {
      source: "company_id",
      label: t("resources.contacts.fields.company_id"),
      editable: true,
      type: "reference",
      referenceResource: "companies",
      referenceData: companies,
      sortable: true,
      render: (record) => {
        if (!record.company_id) return "-";
        const company = companies.find((c) => c.id === record.company_id);
        if (!company) return "-";
        return (
          <Link
            to={`/companies/${record.company_id}/show`}
            className="text-primary hover:underline inline-flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {company.name}
            <ExternalLink className="h-3 w-3" />
          </Link>
        );
      },
    },
    {
      source: "sales_id",
      label: t("crm.account_manager"),
      editable: true,
      type: "reference",
      referenceResource: "sales",
      referenceData: sales,
      sortable: true,
      render: (record) => {
        if (!record.sales_id) return "-";
        const sale = sales.find((s) => s.id === record.sales_id);
        if (!sale) return "-";
        return (
          <Link
            to={`/sales/${record.sales_id}/show`}
            className="text-primary hover:underline inline-flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {sale.first_name} {sale.last_name}
            <ExternalLink className="h-3 w-3" />
          </Link>
        );
      },
    },
    {
      source: "status",
      label: t("resources.contacts.fields.status"),
      editable: true,
      type: "select",
      options: [
        { value: "cold", label: "Kalt" },
        { value: "warm", label: "Warm" },
        { value: "hot", label: "Heiß" },
        { value: "in-contract", label: "In Vertrag" },
      ],
      sortable: true,
    },
    {
      source: "phone_jsonb",
      label: t("resources.contacts.fields.phone_number"),
      editable: true,
      type: "text",
      sortable: false,
      defaultHidden: true,
      render: (record) => getFirstPhone(record.phone_jsonb),
      getEditValue: (record: Contact) => {
        if (!record.phone_jsonb || !Array.isArray(record.phone_jsonb) || record.phone_jsonb.length === 0) return "";
        return record.phone_jsonb[0]?.number || "";
      },
      transformValue: (value: unknown, record: Contact) => {
        const phoneStr = value as string;
        const existing = record.phone_jsonb && Array.isArray(record.phone_jsonb) ? [...record.phone_jsonb] : [];
        if (existing.length === 0) {
          if (!phoneStr) return { phone_jsonb: [] };
          return { phone_jsonb: [{ number: phoneStr, type: "Work" }] };
        }
        existing[0] = { ...existing[0], number: phoneStr };
        return { phone_jsonb: existing };
      },
    },
    {
      source: "title",
      label: t("resources.contacts.fields.title"),
      editable: true,
      type: "text",
      defaultHidden: true,
    },
    {
      source: "background",
      label: t("resources.contacts.fields.background"),
      editable: true,
      type: "text",
      defaultHidden: true,
    },
  ];
}

// ── Company Columns ──────────────────────────────────────────

function getCompanyColumns(
  t: (key: string, options?: Record<string, string>) => string,
  refs: ColumnRegistryReferenceData,
): EditableColumnDef<Company>[] {
  const { sales = [], companySectors = [], companySizes = [] } = refs;
  return [
    {
      source: "name",
      label: t("resources.companies.fields.name", { _: "Name" }),
      editable: true,
      type: "text",
      sortable: true,
      render: (record) => (
        <Link
          to={`/companies/${record.id}/show`}
          className="text-primary hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {record.name || "-"}
        </Link>
      ),
    },
    {
      source: "sector",
      label: t("resources.companies.fields.sector", { _: "Branche" }),
      editable: true,
      type: "select",
      options: companySectors.map((s) => ({ value: s.value, label: s.label })),
      sortable: true,
    },
    {
      source: "size",
      label: t("resources.companies.fields.size", { _: "Größe" }),
      editable: true,
      type: "select",
      options: companySizes.map((s) => ({ value: String(s.id), label: s.name })),
      sortable: true,
      defaultHidden: true,
    },
    {
      source: "phone_number",
      label: t("resources.companies.fields.phone_number", { _: "Telefon" }),
      editable: true,
      type: "text",
      sortable: false,
    },
    {
      source: "website",
      label: t("resources.companies.fields.website", { _: "Website" }),
      editable: true,
      type: "text",
      sortable: false,
      render: (record) =>
        record.website ? (
          <a
            href={record.website.startsWith("http") ? record.website : `https://${record.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {record.website}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          "-"
        ),
    },
    {
      source: "sales_id",
      label: t("crm.account_manager", { _: "Kundenbetreuer" }),
      editable: true,
      type: "reference",
      referenceResource: "sales",
      referenceData: sales,
      sortable: true,
      render: (record) => {
        if (!record.sales_id) return "-";
        const sale = sales.find((s) => s.id === record.sales_id);
        if (!sale) return "-";
        return (
          <Link
            to={`/sales/${record.sales_id}/show`}
            className="text-primary hover:underline inline-flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {sale.first_name} {sale.last_name}
            <ExternalLink className="h-3 w-3" />
          </Link>
        );
      },
    },
    {
      source: "city",
      label: t("resources.companies.fields.city", { _: "Stadt" }),
      editable: true,
      type: "text",
      sortable: true,
      defaultHidden: true,
    },
    {
      source: "country",
      label: t("resources.companies.fields.country", { _: "Land" }),
      editable: true,
      type: "text",
      sortable: true,
      defaultHidden: true,
    },
    {
      source: "revenue",
      label: t("resources.companies.fields.revenue", { _: "Umsatz" }),
      editable: true,
      type: "text",
      sortable: true,
      defaultHidden: true,
    },
    {
      source: "description",
      label: t("resources.companies.fields.description", { _: "Beschreibung" }),
      editable: true,
      type: "text",
      defaultHidden: true,
    },
  ];
}

// ── Deal Columns ─────────────────────────────────────────────

function getDealColumns(
  t: (key: string, options?: Record<string, string>) => string,
  refs: ColumnRegistryReferenceData,
): EditableColumnDef<Deal>[] {
  const { companies = [], sales = [], dealCategories = [], dealStages = [] } = refs;
  return [
    {
      source: "name",
      label: t("resources.deals.fields.name", { _: "Name" }),
      editable: true,
      type: "text",
      sortable: true,
      render: (record) => (
        <Link
          to={`/deals/${record.id}/show`}
          className="text-primary hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {record.name || "-"}
        </Link>
      ),
    },
    {
      source: "company_id",
      label: t("resources.deals.fields.company_id", { _: "Unternehmen" }),
      editable: true,
      type: "reference",
      referenceResource: "companies",
      referenceData: companies,
      sortable: true,
      render: (record) => {
        if (!record.company_id) return "-";
        const company = companies.find((c) => c.id === record.company_id);
        if (!company) return "-";
        return (
          <Link
            to={`/companies/${record.company_id}/show`}
            className="text-primary hover:underline inline-flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {company.name}
            <ExternalLink className="h-3 w-3" />
          </Link>
        );
      },
    },
    {
      source: "category",
      label: t("resources.deals.fields.category", { _: "Kategorie" }),
      editable: true,
      type: "select",
      options: dealCategories.map((c) => ({ value: c.value, label: c.label })),
      sortable: true,
    },
    {
      source: "stage",
      label: t("resources.deals.fields.stage", { _: "Phase" }),
      editable: true,
      type: "select",
      options: dealStages.map((s) => ({ value: s.value, label: s.label })),
      sortable: true,
    },
    {
      source: "amount",
      label: t("resources.deals.fields.amount", { _: "Betrag" }),
      editable: true,
      type: "number",
      sortable: true,
      render: (record) =>
        record.amount != null
          ? `€ ${Number(record.amount).toLocaleString("de-DE", { minimumFractionDigits: 2 })}`
          : "-",
    },
    {
      source: "expected_closing_date",
      label: t("resources.deals.fields.expected_closing_date", { _: "Abschlussdatum" }),
      editable: true,
      type: "text",
      sortable: true,
      render: (record) => {
        if (!record.expected_closing_date) return "-";
        try {
          return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(
            new Date(record.expected_closing_date),
          );
        } catch {
          return String(record.expected_closing_date);
        }
      },
    },
    {
      source: "sales_id",
      label: t("crm.account_manager", { _: "Kundenbetreuer" }),
      editable: true,
      type: "reference",
      referenceResource: "sales",
      referenceData: sales,
      sortable: true,
      render: (record) => {
        if (!record.sales_id) return "-";
        const sale = sales.find((s) => s.id === record.sales_id);
        if (!sale) return "-";
        return (
          <Link
            to={`/sales/${record.sales_id}/show`}
            className="text-primary hover:underline inline-flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {sale.first_name} {sale.last_name}
            <ExternalLink className="h-3 w-3" />
          </Link>
        );
      },
    },
    {
      source: "description",
      label: t("resources.deals.fields.description", { _: "Beschreibung" }),
      editable: true,
      type: "text",
      defaultHidden: true,
    },
    {
      source: "created_at",
      label: t("resources.deals.fields.created_at", { _: "Erstellt" }),
      editable: false,
      type: "text",
      sortable: true,
      defaultHidden: true,
      render: (record) => {
        if (!record.created_at) return "-";
        try {
          return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(
            new Date(record.created_at),
          );
        } catch {
          return String(record.created_at);
        }
      },
    },
  ];
}

// ── Public API ────────────────────────────────────────────────

export type EntityType = "contacts" | "companies" | "deals";

const ENTITY_ID_FIELD: Record<EntityType, "contact_id" | "company_id" | "deal_id"> = {
  contacts: "contact_id",
  companies: "company_id",
  deals: "deal_id",
};

const DEFAULT_SORT: Record<EntityType, { field: string; order: "ASC" | "DESC" }> = {
  contacts: { field: "last_name", order: "ASC" },
  companies: { field: "name", order: "ASC" },
  deals: { field: "created_at", order: "DESC" },
};

const ENTITY_LABELS: Record<EntityType, { title: string; description: string }> = {
  contacts: {
    title: "crm.contacts",
    description: "crm.editable_grid_description",
  },
  companies: {
    title: "crm.companies",
    description: "crm.editable_grid_description_companies",
  },
  deals: {
    title: "crm.deals",
    description: "crm.editable_grid_description_deals",
  },
};

export function getBuiltinColumns(
  resource: string,
  translate: (key: string, options?: Record<string, string>) => string,
  refs: ColumnRegistryReferenceData,
): EditableColumnDef<any>[] {
  switch (resource) {
    case "contacts":
      return getContactColumns(translate, refs);
    case "companies":
      return getCompanyColumns(translate, refs);
    case "deals":
      return getDealColumns(translate, refs);
    default:
      return []; // Custom objects have no built-in columns
  }
}

export function getEntityIdField(resource: string): "contact_id" | "company_id" | "deal_id" | undefined {
  return ENTITY_ID_FIELD[resource as EntityType];
}

export function getDefaultSort(resource: string): { field: string; order: "ASC" | "DESC" } {
  return DEFAULT_SORT[resource as EntityType] || { field: "id", order: "DESC" };
}

export function getEntityLabels(resource: string, translate: (key: string, options?: Record<string, string>) => string) {
  const labels = ENTITY_LABELS[resource as EntityType];
  if (labels) {
    return {
      title: translate(labels.title, { _: resource }),
      description: translate(labels.description, { _: `Bearbeiten Sie ${resource} direkt in der Tabelle` }),
    };
  }
  return {
    title: resource,
    description: `Bearbeiten Sie ${resource} direkt in der Tabelle`,
  };
}
