import { useMemo } from "react";
import { useGetList } from "ra-core";
import type { RaRecord } from "ra-core";
import type { EditableColumnDef } from "@/components/admin/editable-datagrid";
import type { CustomFieldDefinition, CustomObjectDefinition } from "../types/custom-objects";

/**
 * Hook that returns EditableDataGrid columns for custom fields of a given entity type.
 * Also returns a transformValue handler for saving values to the custom_field_values table.
 */
export function useCustomFieldColumns<RecordType extends RaRecord = RaRecord>(
  entityType: "contacts" | "companies" | "deals",
  entityIdField: "contact_id" | "company_id" | "deal_id",
): {
  columns: EditableColumnDef<RecordType>[];
  customFieldValues: Record<string, Record<number, unknown>>;
  isLoading: boolean;
} {
  // Load custom field definitions for this entity type
  const { data: fieldDefs, isLoading: defsLoading } =
    useGetList<CustomFieldDefinition>("custom_field_definitions", {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sort_order", order: "ASC" },
      filter: {
        entity_type: entityType,
        "custom_object_id@is": "null",
        "deleted_at@is": "null",
        show_in_list: true,
      },
    });

  // Load ALL custom field values for this entity type — we match by field_definition_id
  const fieldDefIds = fieldDefs?.map((f) => f.id) || [];
  const { data: values, isLoading: valuesLoading } = useGetList(
    "custom_field_values",
    {
      pagination: { page: 1, perPage: 5000 },
      filter:
        fieldDefIds.length > 0
          ? {
              [`${entityIdField}@not.is`]: "null",
            }
          : { id: -1 }, // Don't fetch if no field defs exist
    },
  );

  // Collect all reference_object targets we need to load
  const refTargets = useMemo(() => {
    if (!fieldDefs) return [] as string[];
    return [...new Set(
      fieldDefs
        .filter((f) => f.field_type === "reference" && f.reference_object)
        .map((f) => f.reference_object as string),
    )];
  }, [fieldDefs]);

  // Load reference data for built-in resources
  const { data: refContacts } = useGetList("contacts", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "last_name", order: "ASC" },
    filter: refTargets.includes("contacts") ? {} : { id: -1 },
  });
  const { data: refCompanies } = useGetList("companies", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "name", order: "ASC" },
    filter: refTargets.includes("companies") ? {} : { id: -1 },
  });
  const { data: refDeals } = useGetList("deals", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "name", order: "ASC" },
    filter: refTargets.includes("deals") ? {} : { id: -1 },
  });
  const { data: refSales } = useGetList("sales", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "last_name", order: "ASC" },
    filter: refTargets.includes("sales") ? {} : { id: -1 },
  });

  // For custom_* targets, load from custom_object_data
  const customRefTarget = refTargets.find((t) => t.startsWith("custom_"));
  const { data: customObjDefs } = useGetList<CustomObjectDefinition>(
    "custom_object_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "name", order: "ASC" },
      filter: customRefTarget
        ? { name: customRefTarget.replace("custom_", "") }
        : { id: -1 },
    },
  );
  const customDefId = customObjDefs?.[0]?.id;
  const { data: refCustomData } = useGetList("custom_object_data", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "id", order: "ASC" },
    filter: customDefId
      ? { object_definition_id: customDefId }
      : { id: -1 },
  });

  // Build referenceData map: { target: RaRecord[] }
  const refDataMap = useMemo(() => {
    const map: Record<string, RaRecord[]> = {};
    if (refContacts) map.contacts = refContacts;
    if (refCompanies) map.companies = refCompanies;
    if (refDeals) map.deals = refDeals;
    if (refSales) map.sales = refSales;
    if (customRefTarget && refCustomData) map[customRefTarget] = refCustomData;
    return map;
  }, [refContacts, refCompanies, refDeals, refSales, customRefTarget, refCustomData]);

  // Helper to get display label for a reference record
  const getRefLabel = (target: string, refRecord: RaRecord, displayField?: string | null): string => {
    if (target === "contacts" || target === "sales") {
      return [refRecord.first_name, refRecord.last_name].filter(Boolean).join(" ") || `#${refRecord.id}`;
    }
    if (target.startsWith("custom_")) {
      const d = (refRecord.data || {}) as Record<string, unknown>;
      return String(d[displayField || "name"] || d.name || d.title || `#${refRecord.id}`);
    }
    return String(refRecord.name || refRecord.title || refRecord.label || `#${refRecord.id}`);
  };

  // Build a lookup: { fieldDefId: { entityId: value } }
  const customFieldValues = useMemo(() => {
    const result: Record<string, Record<number, unknown>> = {};
    if (!values) return result;
    for (const v of values) {
      const fieldId = String(v.field_definition_id);
      const entityId = v[entityIdField] as number;
      if (!entityId) continue;
      if (!result[fieldId]) result[fieldId] = {};
      result[fieldId][entityId] = v.value;
    }
    return result;
  }, [values, entityIdField]);

  // Convert field definitions to EditableDataGrid columns
  const columns = useMemo<EditableColumnDef<RecordType>[]>(() => {
    if (!fieldDefs) return [];
    return fieldDefs.map((fieldDef) => {
      const col: EditableColumnDef<RecordType> = {
        source: `_cf_${fieldDef.name}`,
        label: fieldDef.label,
        editable: fieldDef.field_type === "boolean", // Boolean fields are directly togglable
        sortable: false,
        defaultHidden: false,
        width: fieldDef.column_width
          ? `${fieldDef.column_width}px`
          : undefined,
        render: (record) => {
          const fieldValues = customFieldValues[String(fieldDef.id)];
          const val = fieldValues?.[record.id as number];
          if (val === null || val === undefined) return "-";
          if (typeof val === "boolean") return val ? "Ja" : "Nein";
          if (Array.isArray(val)) return val.join(", ");
          return String(val);
        },
      };

      // Map field type to editable type
      if (fieldDef.field_type === "boolean") {
        col.type = "boolean";
        // Inject the current CF value as the record's _cf_ field so EditableCell reads it
        col.getEditValue = (record) => {
          const fieldValues = customFieldValues[String(fieldDef.id)];
          return Boolean(fieldValues?.[record.id as number]);
        };
        // Render override: use the CF lookup, not the record field
        col.render = (record) => {
          const fieldValues = customFieldValues[String(fieldDef.id)];
          const val = fieldValues?.[record.id as number];
          return val ? "Ja" : "Nein";
        };
      } else if (fieldDef.field_type === "reference" && fieldDef.reference_object) {
        const target = fieldDef.reference_object;
        const displayField = fieldDef.reference_display_field;
        const refRecords = refDataMap[target] || [];
        col.editable = true;
        col.type = "reference";
        col.referenceResource = target;
        col.referenceData = refRecords.map((r) => ({
          ...r,
          name: getRefLabel(target, r, displayField),
        }));
        col.getEditValue = (record) => {
          const fieldValues = customFieldValues[String(fieldDef.id)];
          const val = fieldValues?.[record.id as number];
          return val ?? null;
        };
        col.render = (record) => {
          const fieldValues = customFieldValues[String(fieldDef.id)];
          const val = fieldValues?.[record.id as number];
          if (!val) return "-";
          const ref = refRecords.find((r) => String(r.id) === String(val));
          return ref ? getRefLabel(target, ref, displayField) : String(val);
        };
      } else if (
        fieldDef.field_type === "select" &&
        fieldDef.options &&
        fieldDef.options.length > 0
      ) {
        col.type = "select";
        col.options = fieldDef.options.map((o) => ({
          value: o.value,
          label: o.label,
        }));
      } else if (fieldDef.field_type === "number") {
        col.type = "number";
      } else {
        col.type = "text";
      }

      return col;
    });
  }, [fieldDefs, customFieldValues]);

  return {
    columns,
    customFieldValues,
    isLoading: defsLoading || valuesLoading,
  };
}
