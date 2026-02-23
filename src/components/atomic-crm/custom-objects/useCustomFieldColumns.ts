import { useMemo } from "react";
import { useGetList } from "ra-core";
import type { RaRecord } from "ra-core";
import type { EditableColumnDef } from "@/components/admin/editable-datagrid";
import type { CustomFieldDefinition } from "../types/custom-objects";

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
        editable: false, // Custom field values are stored separately — editing requires a custom save flow
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
      if (
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
