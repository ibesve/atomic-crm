/**
 * GenericDataGrid — A single unified data grid component for all entity types.
 * Replaces ContactDataGrid, CompanyDataGrid, and adds DealsDataGrid functionality.
 * Also supports custom objects when given an objectDefinitionId.
 *
 * Uses the column-registry for built-in columns and useCustomFieldColumns
 * for dynamic custom field columns on built-in entities.
 *
 * Integrates:
 * - AdvancedFilterBuilder: row-based filter UI with AND/OR logic
 * - SavedViewsManager: save/load/share filter views
 * - ExportToolbar: PDF and Excel export
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslate, useGetList } from "ra-core";
import { useNavigate } from "react-router";
import { EditableDataGrid } from "@/components/admin/editable-datagrid";
import type { EditableColumnDef } from "@/components/admin/editable-datagrid";
import type { RaRecord } from "ra-core";
import type { Company, Sale } from "./types";
import type { SavedView, SavedViewFilters, SavedViewSort } from "./types/custom-objects";
import { useConfigurationContext } from "./root/ConfigurationContext";
import { sizes } from "./companies/sizes";
import {
  getBuiltinColumns,
  getEntityIdField,
  getDefaultSort,
  getEntityLabels,
} from "./column-registry";
import type { EntityType, ColumnRegistryReferenceData } from "./column-registry";
import { useCustomFieldColumns } from "./custom-objects/useCustomFieldColumns";
import { AdvancedFilterBuilder, filtersToPostgREST, buildCFClientFilter } from "./AdvancedFilterBuilder";
import type { FilterFieldDef } from "./AdvancedFilterBuilder";
import { SavedViewsManager } from "./SavedViewsManager";
import { ExportToolbar } from "./ExportToolbar";
import type { ExportColumn, ExportReferenceConfig } from "./ExportToolbar";

interface GenericDataGridProps {
  /** The resource name: 'contacts', 'companies', 'deals', or a custom resource */
  resource: string;
  /** For built-in entities: which entity type (determines custom field loading) */
  entityType?: EntityType;
  /** Optional localStorage persistence key */
  storeKey?: string;
  /** Callback when row is clicked */
  onRowClick?: (record: RaRecord) => void;
  /** Callback when create button is clicked */
  onCreate?: () => void;
  /** Whether to show bulk actions */
  bulkActions?: boolean;
  /** Whether to enable soft delete toggle */
  enableSoftDelete?: boolean;
  /** Custom title override */
  title?: string;
  /** Custom description override */
  description?: string;
}

const DEFAULT_FILTERS: SavedViewFilters = {
  logic: "and",
  rules: [{ field: "", operator: "eq", value: "" }],
};

export const GenericDataGrid = ({
  resource,
  entityType,
  storeKey,
  onRowClick,
  onCreate,
  bulkActions = true,
  enableSoftDelete = false,
  title: titleOverride,
  description: descriptionOverride,
}: GenericDataGridProps) => {
  const translate = useTranslate();
  const navigate = useNavigate();
  const { companySectors, dealCategories, dealStages } = useConfigurationContext();

  // ── Filter State ────────────────────────────────────────────
  const [filters, setFilters] = useState<SavedViewFilters>(DEFAULT_FILTERS);
  const [currentSort, setCurrentSort] = useState<SavedViewSort | null>(null);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);

  // Reset state when navigating between different resources (e.g. contacts → companies)
  // to prevent stale sort/filter from causing 400 errors on the new resource's view.
  useEffect(() => {
    setFilters(DEFAULT_FILTERS);
    setCurrentSort(null);
    setSelectedIds([]);
    setHiddenColumns([]);
  }, [resource]);

  // ── Reference Data ──────────────────────────────────────────
  const { data: companies } = useGetList<Company>("companies", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "name", order: "ASC" },
  });

  const { data: sales } = useGetList<Sale>("sales", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "last_name", order: "ASC" },
  });

  // ── Column Registry Reference Data ─────────────────────────
  const refs: ColumnRegistryReferenceData = useMemo(
    () => ({
      companies: companies || [],
      sales: sales || [],
      companySectors,
      dealCategories,
      dealStages,
      companySizes: sizes,
    }),
    [companies, sales, companySectors, dealCategories, dealStages],
  );

  // ── Built-in Columns ───────────────────────────────────────
  const builtinColumns = useMemo(
    () => getBuiltinColumns(resource, translate, refs),
    [resource, translate, refs],
  );

  // ── Custom Field Columns ────────────────────────────────────
  // Must be defined BEFORE filter computation so effectiveCfLookup is available
  const entityIdField = getEntityIdField(resource);
  const isBuiltinEntity = !!entityType && !!entityIdField;

  const { columns: customFieldCols, cfValuesBySource } = useCustomFieldColumns(
    isBuiltinEntity ? entityType! : "contacts",
    isBuiltinEntity ? entityIdField! : "contact_id",
  );

  const effectiveCfCols = isBuiltinEntity ? customFieldCols : [];
  const effectiveCfLookup = isBuiltinEntity ? cfValuesBySource : {};

  // ── Filtered Data (for export) ──────────────────────────────
  const postgrestFilters = useMemo(() => filtersToPostgREST(filters), [filters]);
  const cfClientFilter = useMemo(
    () => buildCFClientFilter(filters, effectiveCfLookup),
    [filters, effectiveCfLookup],
  );
  const { data: rawFilteredData } = useGetList(resource, {
    pagination: { page: 1, perPage: 1000 },
    sort: currentSort
      ? { field: currentSort.field, order: currentSort.order }
      : getDefaultSort(resource),
    filter: postgrestFilters,
  });

  // Apply custom-field filters client-side (CF values are merged via afterRead)
  const filteredData = useMemo(() => {
    if (!rawFilteredData || !cfClientFilter) return rawFilteredData;
    return rawFilteredData.filter((r) => cfClientFilter(r as Record<string, unknown>));
  }, [rawFilteredData, cfClientFilter]);

  // ── Merged Columns ──────────────────────────────────────────
  const allColumns: EditableColumnDef<any>[] = useMemo(
    () => [...builtinColumns, ...effectiveCfCols],
    [builtinColumns, effectiveCfCols],
  );

  // ── Filter Fields (derived from columns) ────────────────────
  const filterFields: FilterFieldDef[] = useMemo(
    () =>
      allColumns
        .filter((col) => col.source)
        .map((col) => ({
          source: col.source!,
          label: col.label || col.source || "",
          type: col.type || "text",
          options: col.options,
          referenceData: col.referenceData,
        })),
    [allColumns],
  );

  // ── Export Columns (derived from visible columns, respecting user-hidden) ───
  const exportColumns: ExportColumn[] = useMemo(
    () =>
      allColumns
        .filter((col) => col.source && !hiddenColumns.includes(col.source))
        .map((col) => {
          const base: ExportColumn = {
            source: col.source!,
            label: col.label || col.source || "",
          };

          // Resolve email_jsonb → first email string
          if (col.source === "email_jsonb") {
            base.format = (value: unknown) => {
              if (!value || !Array.isArray(value) || value.length === 0) return "-";
              return value.map((e: { email?: string }) => e?.email).filter(Boolean).join(", ") || "-";
            };
          }
          // Resolve phone_jsonb → first phone string
          else if (col.source === "phone_jsonb") {
            base.format = (value: unknown) => {
              if (!value || !Array.isArray(value) || value.length === 0) return "-";
              return value.map((p: { number?: string }) => p?.number).filter(Boolean).join(", ") || "-";
            };
          }
          // Resolve reference IDs → display names
          else if (col.type === "reference" && col.referenceData) {
            const refData = [...col.referenceData];
            const refResource = col.referenceResource;
            base.format = (value: unknown) => {
              if (value == null) return "-";
              const record = refData.find((r) => r.id === value);
              if (!record) return String(value);
              if (refResource === "sales") {
                return `${record.first_name || ""} ${record.last_name || ""}`.trim() || String(value);
              }
              if ("name" in record) return String(record.name) || String(value);
              return String(value);
            };
          }
          // Resolve select values → labels
          else if (col.type === "select" && col.options) {
            const opts = [...col.options];
            base.format = (value: unknown) => {
              if (value == null || value === "") return "-";
              const opt = opts.find((o) => o.value === String(value) || o.value === value);
              return opt ? opt.label : String(value);
            };
          }
          // Format amounts
          else if (col.type === "number") {
            base.format = (value: unknown) => {
              if (value == null) return "-";
              return Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2 });
            };
          }

          return base;
        }),
    [allColumns, hiddenColumns],
  );

  // ── Labels ──────────────────────────────────────────────────
  const labels = getEntityLabels(resource, translate);
  const displayTitle = titleOverride || labels.title;
  const displayDescription = descriptionOverride || labels.description;

  // ── Export Reference Configs (sub-object field selection) ───
  const exportReferenceConfigs: ExportReferenceConfig[] = useMemo(() => {
    const configs: ExportReferenceConfig[] = [];

    // Only add references if we have loaded data
    if (resource === "contacts" || resource === "deals") {
      if (companies && companies.length > 0) {
        configs.push({
          foreignKey: "company_id",
          label: translate("resources.companies.name", { smart_count: 1, _: "Unternehmen" }),
          data: companies,
          fields: [
            { source: "name", label: translate("resources.companies.fields.name", { _: "Name" }) },
            { source: "sector", label: translate("resources.companies.fields.sector", { _: "Branche" }) },
            { source: "phone_number", label: translate("resources.companies.fields.phone_number", { _: "Telefon" }) },
            { source: "website", label: translate("resources.companies.fields.website", { _: "Website" }) },
            { source: "city", label: translate("resources.companies.fields.city", { _: "Stadt" }) },
            { source: "country", label: translate("resources.companies.fields.country", { _: "Land" }) },
            { source: "address", label: translate("resources.companies.fields.address", { _: "Adresse" }) },
            { source: "zipcode", label: translate("resources.companies.fields.zipcode", { _: "PLZ" }) },
            { source: "revenue", label: translate("resources.companies.fields.revenue", { _: "Umsatz" }) },
            { source: "description", label: translate("resources.companies.fields.description", { _: "Beschreibung" }) },
          ],
        });
      }
    }

    if (sales && sales.length > 0) {
      // All entities can have sales_id
      const hasSalesRef = allColumns.some((c) => c.source === "sales_id");
      if (hasSalesRef) {
        configs.push({
          foreignKey: "sales_id",
          label: translate("crm.account_manager", { _: "Kundenbetreuer" }),
          data: sales,
          fields: [
            { source: "first_name", label: translate("resources.sales.fields.first_name", { _: "Vorname" }) },
            { source: "last_name", label: translate("resources.sales.fields.last_name", { _: "Nachname" }) },
            { source: "email", label: translate("resources.sales.fields.email", { _: "E-Mail" }) },
          ],
        });
      }
    }

    // Add custom field reference columns as export reference configs
    for (const col of effectiveCfCols) {
      if (col.type === "reference" && col.referenceData && col.referenceData.length > 0) {
        const refData = col.referenceData;
        // Derive available fields from first record
        const sampleRecord = refData[0];
        const fields: { source: string; label: string }[] = [];
        if (sampleRecord) {
          for (const key of Object.keys(sampleRecord)) {
            if (key === "id" || key === "data") continue;
            fields.push({ source: key, label: key });
          }
          // For custom objects, also expose data sub-fields
          if (sampleRecord.data && typeof sampleRecord.data === "object") {
            for (const key of Object.keys(sampleRecord.data as Record<string, unknown>)) {
              fields.push({ source: `data.${key}`, label: key });
            }
          }
        }
        if (fields.length > 0) {
          configs.push({
            foreignKey: col.source!,
            label: col.label || col.source || "",
            data: refData,
            fields,
          });
        }
      }
    }

    return configs;
  }, [resource, companies, sales, allColumns, effectiveCfCols, translate]);

  // ── Handlers ────────────────────────────────────────────────
  const defaultOnRowClick = (record: RaRecord) => {
    navigate(`/${resource}/${record.id}/show`);
  };
  const defaultOnCreate = () => {
    navigate(`/${resource}/create`);
  };

  const handleLoadView = useCallback((view: SavedView) => {
    if (view.filters) setFilters(view.filters);
    if (view.sort) setCurrentSort(view.sort);
  }, []);

  const handleClearView = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setCurrentSort(null);
  }, []);

  const defaultSort = getDefaultSort(resource);
  const effectiveStoreKey = storeKey || `datagrid_${resource}_v2`;

  return (
    <div className="p-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{displayTitle}</h1>
        <p className="text-muted-foreground">{displayDescription}</p>
      </div>

      {/* Toolbar: Filter + SavedViews + Export */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <AdvancedFilterBuilder
          fields={filterFields}
          filters={filters}
          onChange={setFilters}
          compact
        />
        <SavedViewsManager
          resource={resource}
          currentFilters={filters}
          currentSort={currentSort}
          currentColumns={null}
          onLoadView={handleLoadView}
          onClearView={handleClearView}
        />
        <div className="flex-1" />
        <ExportToolbar
          columns={exportColumns}
          data={(
            selectedIds.length > 0
              ? (filteredData || []).filter((r) => selectedIds.includes(r.id))
              : (filteredData || [])
          ) as Record<string, unknown>[]}
          filename={resource}
          title={displayTitle}
          description={displayDescription}
          referenceConfigs={exportReferenceConfigs}
          storeKey={effectiveStoreKey}
        />
      </div>

      {/* Data Grid */}
      <EditableDataGrid
        columns={allColumns}
        resource={resource}
        defaultSort={defaultSort}
        onCreate={onCreate || defaultOnCreate}
        bulkActions={bulkActions}
        enableSoftDelete={enableSoftDelete}
        storeKey={effectiveStoreKey}
        onRowClick={onRowClick || defaultOnRowClick}
        externalFilter={postgrestFilters}
        clientSideFilter={cfClientFilter}
        onSelectionChange={setSelectedIds}
        onHiddenColumnsChange={setHiddenColumns}
      />
    </div>
  );
};

export default GenericDataGrid;
