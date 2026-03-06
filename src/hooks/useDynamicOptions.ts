import { useMemo } from "react";
import { useGetList } from "ra-core";
import type { SelectOption, CustomFieldDefinition } from "../components/atomic-crm/types/custom-objects";

/**
 * Resolve a label from a custom_object_data record.
 * labelCol can be "name" (top-level column) or a key inside the JSONB `data` column.
 */
function resolveCustomObjectLabel(
  record: Record<string, unknown>,
  labelCol: string
): string {
  // Top-level column (e.g. "name")
  if (labelCol in record && record[labelCol] != null) {
    return String(record[labelCol]);
  }
  // Try inside data JSONB
  const data = record.data as Record<string, unknown> | undefined;
  if (data && labelCol in data && data[labelCol] != null) {
    return String(data[labelCol]);
  }
  return String(record.name ?? record.id ?? "");
}

/**
 * Resolve a display template string like "{name} ({city})" against a record.
 * Supports top-level fields and `data.field` syntax for JSONB sub-fields.
 * Returns null if no template or template produces empty string.
 */
function resolveDisplayTemplate(
  template: string | null | undefined,
  record: Record<string, unknown>,
): string | null {
  if (!template || !template.includes("{")) return null;
  const dataObj = record.data as Record<string, unknown> | undefined;
  const result = template.replace(/\{([\w.]+)\}/g, (_, field: string) => {
    // Support data.fieldname syntax
    if (field.startsWith("data.") && dataObj) {
      const subField = field.slice(5);
      const val = dataObj[subField];
      return val != null ? String(val) : "";
    }
    // Top-level field
    const val = record[field] ?? dataObj?.[field];
    return val != null ? String(val) : "";
  });
  return result.trim() || null;
}

/**
 * Parse a __custom_object__<id> marker into the numeric object_definition_id, or null.
 */
function parseCustomObjectId(sourceTable: string | null | undefined): number | null {
  if (!sourceTable) return null;
  const match = sourceTable.match(/^__custom_object__(\d+)$/);
  return match ? Number(match[1]) : null;
}

/**
 * Hook that resolves options for a select/multiselect custom field.
 * Supports four modes:
 * - 'static': returns fieldDef.options directly (current behavior)
 * - 'table': loads options from a Supabase table
 * - 'view': loads options from a Supabase view (same mechanism as table via PostgREST)
 * - 'custom_object': loads options from custom_object_data filtered by object_definition_id
 */
export function useDynamicOptions(fieldDef: CustomFieldDefinition | null): {
  options: SelectOption[];
  isLoading: boolean;
} {
  const isTableOrView =
    fieldDef?.options_source === "table" || fieldDef?.options_source === "view";
  const isCustomObject = fieldDef?.options_source === "custom_object";
  const isDynamic = isTableOrView || isCustomObject;

  const sourceTable = fieldDef?.source_table || "";
  const valueCol = fieldDef?.source_value_column || "id";
  const labelCol = fieldDef?.source_label_column || "name";
  const sourceFilter = fieldDef?.source_filter || {};

  // For custom_object, resolve to actual table + filter
  const customObjectId = useMemo(
    () => parseCustomObjectId(fieldDef?.source_table),
    [fieldDef?.source_table]
  );
  const effectiveTable = isCustomObject ? "custom_object_data" : sourceTable;
  const effectiveFilter = useMemo(
    () =>
      isCustomObject && customObjectId != null
        ? { ...sourceFilter, object_definition_id: customObjectId }
        : sourceFilter,
    [isCustomObject, customObjectId, sourceFilter]
  );

  const { data: dynamicData, isLoading } = useGetList(
    effectiveTable,
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: isCustomObject ? "name" : labelCol, order: "ASC" },
      filter: effectiveFilter,
    },
    { enabled: isDynamic && !!effectiveTable && effectiveTable !== "__none__" }
  );

  const options = useMemo(() => {
    if (!fieldDef) return [];

    // Static mode: return stored options
    if (!isDynamic) {
      return fieldDef.options || [];
    }

    // Dynamic mode: map fetched records to SelectOption[]
    if (!dynamicData) return [];

    if (isCustomObject) {
      return dynamicData.map((record: Record<string, unknown>) => {
        const tpl = resolveDisplayTemplate(fieldDef.reference_display_field, record);
        return {
          value: String(record.id ?? ""),
          label: tpl || resolveCustomObjectLabel(record, labelCol),
        };
      });
    }

    return dynamicData.map((record: Record<string, unknown>) => {
      const tpl = resolveDisplayTemplate(fieldDef.reference_display_field, record);
      return {
        value: String(record[valueCol] ?? record.id ?? ""),
        label: tpl || String(record[labelCol] ?? record[valueCol] ?? record.id ?? ""),
      };
    });
  }, [fieldDef, isDynamic, isCustomObject, dynamicData, valueCol, labelCol]);

  return {
    options,
    isLoading: isDynamic ? isLoading : false,
  };
}

/**
 * Hook to load all options for multiple field definitions at once.
 * Returns a map of fieldDef.id → SelectOption[].
 * For static fields, returns the options directly.
 * For dynamic fields, groups by source_table and fetches once per table.
 * For custom_object fields, queries custom_object_data with object_definition_id filter.
 */
export function useDynamicOptionsMap(
  fieldDefs: CustomFieldDefinition[]
): {
  optionsMap: Record<number, SelectOption[]>;
  isLoading: boolean;
} {
  // Collect unique dynamic source tables (table/view AND custom_object)
  const dynamicSources = useMemo(() => {
    const sources = new Map<
      string,
      {
        effectiveTable: string;
        valueCol: string;
        labelCol: string;
        filter: Record<string, unknown>;
        fieldDefIds: number[];
        isCustomObject?: boolean;
      }
    >();
    for (const fd of fieldDefs) {
      if (
        (fd.options_source === "table" || fd.options_source === "view") &&
        fd.source_table
      ) {
        const key = fd.source_table;
        const existing = sources.get(key);
        if (existing) {
          existing.fieldDefIds.push(fd.id);
        } else {
          sources.set(key, {
            effectiveTable: fd.source_table,
            valueCol: fd.source_value_column || "id",
            labelCol: fd.source_label_column || "name",
            filter: (fd.source_filter as Record<string, unknown>) || {},
            fieldDefIds: [fd.id],
          });
        }
      } else if (fd.options_source === "custom_object" && fd.source_table) {
        const coId = parseCustomObjectId(fd.source_table);
        if (coId != null) {
          // Use a unique key per custom object definition
          const key = `__co__${coId}`;
          const existing = sources.get(key);
          if (existing) {
            existing.fieldDefIds.push(fd.id);
          } else {
            sources.set(key, {
              effectiveTable: "custom_object_data",
              valueCol: "id",
              labelCol: fd.source_label_column || "name",
              filter: { object_definition_id: coId },
              fieldDefIds: [fd.id],
              isCustomObject: true,
            });
          }
        }
      }
    }
    return sources;
  }, [fieldDefs]);

  // We can only call hooks unconditionally, so we'll use at most 5 dynamic sources
  // For more, we'd need a different approach. This covers practical use cases.
  const sourceEntries = useMemo(
    () => Array.from(dynamicSources.entries()).slice(0, 5),
    [dynamicSources]
  );

  const { data: data0, isLoading: l0 } = useGetList(
    sourceEntries[0]?.[1]?.effectiveTable || "__none__",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: sourceEntries[0]?.[1]?.isCustomObject ? "name" : (sourceEntries[0]?.[1]?.labelCol || "id"), order: "ASC" },
      filter: sourceEntries[0]?.[1]?.filter || {},
    },
    { enabled: sourceEntries.length > 0 }
  );
  const { data: data1, isLoading: l1 } = useGetList(
    sourceEntries[1]?.[1]?.effectiveTable || "__none__",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: sourceEntries[1]?.[1]?.isCustomObject ? "name" : (sourceEntries[1]?.[1]?.labelCol || "id"), order: "ASC" },
      filter: sourceEntries[1]?.[1]?.filter || {},
    },
    { enabled: sourceEntries.length > 1 }
  );
  const { data: data2, isLoading: l2 } = useGetList(
    sourceEntries[2]?.[1]?.effectiveTable || "__none__",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: sourceEntries[2]?.[1]?.isCustomObject ? "name" : (sourceEntries[2]?.[1]?.labelCol || "id"), order: "ASC" },
      filter: sourceEntries[2]?.[1]?.filter || {},
    },
    { enabled: sourceEntries.length > 2 }
  );
  const { data: data3, isLoading: l3 } = useGetList(
    sourceEntries[3]?.[1]?.effectiveTable || "__none__",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: sourceEntries[3]?.[1]?.isCustomObject ? "name" : (sourceEntries[3]?.[1]?.labelCol || "id"), order: "ASC" },
      filter: sourceEntries[3]?.[1]?.filter || {},
    },
    { enabled: sourceEntries.length > 3 }
  );
  const { data: data4, isLoading: l4 } = useGetList(
    sourceEntries[4]?.[1]?.effectiveTable || "__none__",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: sourceEntries[4]?.[1]?.isCustomObject ? "name" : (sourceEntries[4]?.[1]?.labelCol || "id"), order: "ASC" },
      filter: sourceEntries[4]?.[1]?.filter || {},
    },
    { enabled: sourceEntries.length > 4 }
  );

  const dynamicDataSets = [data0, data1, data2, data3, data4];
  const isLoading = l0 || l1 || l2 || l3 || l4;

  const optionsMap = useMemo(() => {
    const map: Record<number, SelectOption[]> = {};

    // First, populate static options
    for (const fd of fieldDefs) {
      if (fd.options_source === "static" || !fd.options_source) {
        map[fd.id] = fd.options || [];
      }
    }

    // Then, populate dynamic options
    sourceEntries.forEach(([, source], idx) => {
      const data = dynamicDataSets[idx];
      if (!data) return;

      // Build default options (without template) for shared use
      const defaultOptions: SelectOption[] = source.isCustomObject
        ? data.map((record: Record<string, unknown>) => ({
            value: String(record.id ?? ""),
            label: resolveCustomObjectLabel(record, source.labelCol),
          }))
        : data.map((record: Record<string, unknown>) => ({
            value: String(record[source.valueCol] ?? record.id ?? ""),
            label: String(record[source.labelCol] ?? record[source.valueCol] ?? record.id ?? ""),
          }));

      for (const fieldDefId of source.fieldDefIds) {
        // Check if this fieldDef has a display template
        const fd = fieldDefs.find((f) => f.id === fieldDefId);
        const template = fd?.reference_display_field;
        if (template && template.includes("{")) {
          // Resolve labels per-record using the template
          map[fieldDefId] = data.map((record: Record<string, unknown>) => {
            const tpl = resolveDisplayTemplate(template, record);
            const defaultLabel = source.isCustomObject
              ? resolveCustomObjectLabel(record, source.labelCol)
              : String(record[source.labelCol] ?? record[source.valueCol] ?? record.id ?? "");
            return {
              value: String(
                source.isCustomObject
                  ? (record.id ?? "")
                  : (record[source.valueCol] ?? record.id ?? ""),
              ),
              label: tpl || defaultLabel,
            };
          });
        } else {
          map[fieldDefId] = defaultOptions;
        }
      }
    });

    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldDefs, sourceEntries, ...dynamicDataSets]);

  return { optionsMap, isLoading };
}
