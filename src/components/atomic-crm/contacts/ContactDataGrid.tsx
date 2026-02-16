import { useTranslate, useGetList } from "ra-core";
import { Link, useNavigate } from "react-router";
import { ExternalLink } from "lucide-react";
import { EditableDataGrid, EditableColumnDef } from "@/components/admin/editable-datagrid";
import type { Contact, Company, Sale } from "../types";

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

  const columns: EditableColumnDef<Contact>[] = [
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
      source: "email",
      label: translate("resources.contacts.fields.email"),
      editable: true,
      type: "text",
      sortable: true,
    },
    {
      source: "company_id",
      label: translate("resources.contacts.fields.company_id"),
      editable: true,
      type: "reference",
      referenceResource: "companies",
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
      source: "phone_number",
      label: translate("resources.contacts.fields.phone_number"),
      editable: true,
      type: "text",
      defaultHidden: true,
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
  ];

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
      />
    </div>
  );
};

export default ContactDataGrid;
