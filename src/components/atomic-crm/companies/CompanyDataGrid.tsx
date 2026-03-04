import { useTranslate, useGetList } from "ra-core";
import { Link, useNavigate } from "react-router";
import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { EditableDataGrid } from "@/components/admin/editable-datagrid";
import type { EditableColumnDef } from "@/components/admin/editable-datagrid";
import type { Company, Sale } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { sizes } from "./sizes";

export const CompanyDataGrid = () => {
  const translate = useTranslate();
  const navigate = useNavigate();
  const { companySectors } = useConfigurationContext();

  // Load reference data for dropdowns
  const { data: sales } = useGetList<Sale>("sales", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "last_name", order: "ASC" },
  });

  const columns: EditableColumnDef<Company>[] = useMemo(
    () => [
      {
        source: "name",
        label: translate("resources.companies.fields.name", { _: "Name" }),
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
        label: translate("resources.companies.fields.sector", { _: "Branche" }),
        editable: true,
        type: "select",
        options: companySectors.map((s) => ({ value: s, label: s })),
        sortable: true,
      },
      {
        source: "size",
        label: translate("resources.companies.fields.size", { _: "Größe" }),
        editable: true,
        type: "select",
        options: sizes.map((s) => ({ value: String(s.id), label: s.name })),
        sortable: true,
        defaultHidden: true,
      },
      {
        source: "phone_number",
        label: translate("resources.companies.fields.phone_number", {
          _: "Telefon",
        }),
        editable: true,
        type: "text",
        sortable: false,
      },
      {
        source: "website",
        label: translate("resources.companies.fields.website", {
          _: "Website",
        }),
        editable: true,
        type: "text",
        sortable: false,
        render: (record) =>
          record.website ? (
            <a
              href={
                record.website.startsWith("http")
                  ? record.website
                  : `https://${record.website}`
              }
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
        label: translate("crm.account_manager", { _: "Kundenbetreuer" }),
        editable: true,
        type: "reference",
        referenceResource: "sales",
        referenceData: sales || [],
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
        source: "city",
        label: translate("resources.companies.fields.city", { _: "Stadt" }),
        editable: true,
        type: "text",
        sortable: true,
        defaultHidden: true,
      },
      {
        source: "country",
        label: translate("resources.companies.fields.country", { _: "Land" }),
        editable: true,
        type: "text",
        sortable: true,
        defaultHidden: true,
      },
      {
        source: "revenue",
        label: translate("resources.companies.fields.revenue", { _: "Umsatz" }),
        editable: true,
        type: "text",
        sortable: true,
        defaultHidden: true,
      },
      {
        source: "description",
        label: translate("resources.companies.fields.description", {
          _: "Beschreibung",
        }),
        editable: true,
        type: "text",
        defaultHidden: true,
      },
    ],
    [translate, companySectors, sales],
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {translate("crm.companies", { _: "Unternehmen" })}
        </h1>
        <p className="text-muted-foreground">
          {translate("crm.editable_grid_description_companies", {
            _: "Bearbeiten Sie Unternehmen direkt in der Tabelle",
          })}
        </p>
      </div>

      <EditableDataGrid<Company>
        columns={columns}
        resource="companies"
        defaultSort={{ field: "name", order: "ASC" }}
        onCreate={() => navigate("/companies/create")}
        bulkActions={true}
        enableSoftDelete={false}
        storeKey="datagrid_companies_v2"
        onRowClick={(record) => {
          navigate(`/companies/${record.id}/show`);
        }}
      />
    </div>
  );
};

export default CompanyDataGrid;
