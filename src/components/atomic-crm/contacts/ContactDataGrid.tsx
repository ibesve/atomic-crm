import { useTranslate, useGetList } from "ra-core";
import { Link, useNavigate } from "react-router";
import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { EditableDataGrid } from "@/components/admin/editable-datagrid";
import type { EditableColumnDef } from "@/components/admin/editable-datagrid";
import type { Contact, Company, Sale } from "../types";

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
    },
    {
      source: "email_jsonb",
      label: translate("resources.contacts.fields.email"),
      editable: false, // JSONB-Felder sind nicht direkt editierbar
      sortable: false,
      render: (record) => getFirstEmail(record.email_jsonb),
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
      editable: false, // JSONB-Felder sind nicht direkt editierbar
      sortable: false,
      defaultHidden: true,
      render: (record) => getFirstPhone(record.phone_jsonb),
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
        columns={columns}
        resource="contacts"
        defaultSort={{ field: "last_name", order: "ASC" }}
        onCreate={() => navigate("/contacts/create")}
        bulkActions={true}
        enableSoftDelete={false}
        storeKey="datagrid_contacts_v2" // Neuer Key um alte localStorage-Einstellungen zu überschreiben
      />
    </div>
  );
};

export default ContactDataGrid;
