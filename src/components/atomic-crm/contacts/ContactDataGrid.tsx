import { useTranslate, useGetList } from "ra-core";
import { Link, useNavigate } from "react-router";
import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { EditableDataGrid } from "@/components/admin/editable-datagrid";
import type { EditableColumnDef } from "@/components/admin/editable-datagrid";
import type { Contact, Company, Sale } from "../types";
import { useCustomFieldColumns } from "../custom-objects/useCustomFieldColumns";

// Hilfsfunktion um die erste E-Mail aus email_jsonb zu extrahieren
const getFirstEmail = (emailJsonb: any): string => {
  if (!emailJsonb || !Array.isArray(emailJsonb) || emailJsonb.length === 0) {
    return "-";
  }
  return emailJsonb[0]?.email || "-";
};

// Hilfsfunktion um die erste Telefonnummer aus phone_jsonb zu extrahieren
const getFirstPhone = (phoneJsonb: any): string => {
  if (!phoneJsonb || !Array.isArray(phoneJsonb) || phoneJsonb.length === 0) {
    return "-";
  }
  return phoneJsonb[0]?.number || "-";
};

export const ContactDataGrid = () => {
  const translate = useTranslate();
  const navigate = useNavigate();

  // Lade Referenzdaten für Dropdown-Auswahl
  const { data: companies } = useGetList<Company>("companies", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "name", order: "ASC" },
  });

  const { data: sales } = useGetList<Sale>("sales", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "last_name", order: "ASC" },
  });

  // Load custom field columns for contacts
  const { columns: customFieldCols } = useCustomFieldColumns<Contact>("contacts", "contact_id");

  // Columns mit useMemo, um sie nur bei Änderungen der Referenzdaten neu zu erstellen
  const columns: EditableColumnDef<Contact>[] = useMemo(() => [
    {
      source: "first_name",
      label: translate("resources.contacts.fields.first_name"),
      editable: true,
      type: "text",
      sortable: true,
    },
    {
      source: "last_name",
      label: translate("resources.contacts.fields.last_name"),
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
      label: translate("resources.contacts.fields.email"),
      editable: true,
      type: "text",
      sortable: false,
      render: (record) => getFirstEmail(record.email_jsonb),
      getEditValue: (record: Contact) => {
        if (!record.email_jsonb || !Array.isArray(record.email_jsonb) || record.email_jsonb.length === 0) {
          return "";
        }
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
      label: translate("resources.contacts.fields.company_id"),
      editable: true,
      type: "reference",
      referenceResource: "companies",
      referenceData: companies || [], // Referenzdaten direkt übergeben
      sortable: true,
      render: (record) => {
        if (!record.company_id) return "-";
        const company = companies?.find((c) => c.id === record.company_id);
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
      label: translate("crm.account_manager"),
      editable: true,
      type: "reference",
      referenceResource: "sales",
      referenceData: sales || [], // Referenzdaten direkt übergeben
      sortable: true,
      render: (record) => {
        if (!record.sales_id) return "-";
        const sale = sales?.find((s) => s.id === record.sales_id);
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
      label: translate("resources.contacts.fields.status"),
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
      label: translate("resources.contacts.fields.phone_number"),
      editable: true,
      type: "text",
      sortable: false,
      defaultHidden: true,
      render: (record) => getFirstPhone(record.phone_jsonb),
      getEditValue: (record: Contact) => {
        if (!record.phone_jsonb || !Array.isArray(record.phone_jsonb) || record.phone_jsonb.length === 0) {
          return "";
        }
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
      label: translate("resources.contacts.fields.title"),
      editable: true,
      type: "text",
      defaultHidden: true,
    },
    {
      source: "background",
      label: translate("resources.contacts.fields.background"),
      editable: true,
      type: "text",
      defaultHidden: true,
    },
  ], [translate, companies, sales]);

  // Merge static columns with dynamic custom field columns
  const allColumns = useMemo(() => [
    ...columns,
    ...customFieldCols,
  ], [columns, customFieldCols]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{translate("crm.contacts")}</h1>
        <p className="text-muted-foreground">
          {translate("crm.editable_grid_description", {
            _: "Bearbeiten Sie Kontakte direkt in der Tabelle",
          })}
        </p>
      </div>

      <EditableDataGrid<Contact>
        columns={allColumns}
        resource="contacts"
        defaultSort={{ field: "last_name", order: "ASC" }}
        onCreate={() => navigate("/contacts/create")}
        bulkActions={true}
        enableSoftDelete={false}
        storeKey="datagrid_contacts_v2"
        onRowClick={(record) => {
          navigate(`/contacts/${record.id}/show`);
        }}
      />
    </div>
  );
};

export default ContactDataGrid;
