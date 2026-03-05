import { useMemo } from "react";
import {
  useRecordContext,
  useGetList,
  useUpdate,
  useNotify,
  useRefresh,
  useTranslate,
} from "ra-core";
import type { RaRecord } from "ra-core";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomFieldDefinition, CustomObjectDefinition } from "../types/custom-objects";

interface CustomFieldsDisplayProps {
  entityType: "contacts" | "companies" | "deals";
  entityIdField: "contact_id" | "company_id" | "deal_id";
}

/**
 * Displays custom field values for a record in show/detail view.
 * Boolean fields render as a Switch that saves on toggle.
 * Other fields render as text.
 */
export const CustomFieldsDisplay = ({
  entityType,
  entityIdField,
}: CustomFieldsDisplayProps) => {
  const record = useRecordContext<RaRecord>();
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [update, { isPending }] = useUpdate();

  // Load custom field definitions
  const { data: fieldDefs } = useGetList<CustomFieldDefinition>(
    "custom_field_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sort_order", order: "ASC" },
      filter: {
        entity_type: entityType,
        "custom_object_id@is": "null",
        "deleted_at@is": "null",
      },
    },
  );

  // Load custom field values for this record
  const { data: cfValues } = useGetList("custom_field_values", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "id", order: "ASC" },
    filter: record?.id ? { [entityIdField]: record.id } : { id: -1 },
  });

  // Map field_definition_id → value record
  const valuesByFieldId = useMemo(() => {
    const map = new Map<number, { id: number; value: unknown }>();
    if (!cfValues) return map;
    for (const v of cfValues) {
      map.set(v.field_definition_id as number, {
        id: v.id as number,
        value: v.value,
      });
    }
    return map;
  }, [cfValues]);

  // ── Reference data loading ──────────────────────────────────
  const refTargets = useMemo(() => {
    if (!fieldDefs) return [] as string[];
    return [...new Set(
      fieldDefs
        .filter((f) => f.field_type === "reference" && f.reference_object)
        .map((f) => f.reference_object as string),
    )];
  }, [fieldDefs]);

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
    filter: customDefId ? { object_definition_id: customDefId } : { id: -1 },
  });

  const refDataMap = useMemo(() => {
    const map: Record<string, RaRecord[]> = {};
    if (refContacts) map.contacts = refContacts;
    if (refCompanies) map.companies = refCompanies;
    if (refDeals) map.deals = refDeals;
    if (refSales) map.sales = refSales;
    if (customRefTarget && refCustomData) map[customRefTarget] = refCustomData;
    return map;
  }, [refContacts, refCompanies, refDeals, refSales, customRefTarget, refCustomData]);

  const getRefLabel = (target: string, r: RaRecord, displayField?: string | null): string => {
    if (target === "contacts" || target === "sales")
      return [r.first_name, r.last_name].filter(Boolean).join(" ") || `#${r.id}`;
    if (target.startsWith("custom_")) {
      const d = (r.data || {}) as Record<string, unknown>;
      return String(d[displayField || "name"] || d.name || d.title || `#${r.id}`);
    }
    return String(r.name || r.title || r.label || `#${r.id}`);
  };

  if (!record || !fieldDefs || fieldDefs.length === 0) return null;

  // ── Save helpers ─────────────────────────────────────────────
  const saveCfValue = async (
    fieldDef: CustomFieldDefinition,
    newValue: unknown,
  ) => {
    const existing = valuesByFieldId.get(fieldDef.id);
    if (existing) {
      await update(
        "custom_field_values",
        {
          id: existing.id,
          data: { value: newValue, updated_at: new Date().toISOString() },
          previousData: existing,
        },
        {
          onSuccess: () => {
            notify(translate("ra.notification.updated", { smart_count: 1 }), { type: "success" });
            refresh();
          },
          onError: (err: Error) => {
            notify(err.message || translate("ra.notification.http_error"), { type: "error" });
          },
        },
      );
    } else {
      await update(
        entityType,
        {
          id: record.id,
          data: { [`_cf_${fieldDef.name}`]: newValue },
          previousData: record,
        },
        {
          onSuccess: () => {
            notify(translate("ra.notification.updated", { smart_count: 1 }), { type: "success" });
            refresh();
          },
          onError: (err: Error) => {
            notify(err.message || translate("ra.notification.http_error"), { type: "error" });
          },
        },
      );
    }
  };

  const handleBooleanToggle = async (
    fieldDef: CustomFieldDefinition,
    checked: boolean,
  ) => {
    const existing = valuesByFieldId.get(fieldDef.id);

    if (existing) {
      // Update existing custom_field_values row
      await update(
        "custom_field_values",
        {
          id: existing.id,
          data: { value: checked, updated_at: new Date().toISOString() },
          previousData: existing,
        },
        {
          onSuccess: () => {
            notify(
              translate("ra.notification.updated", { smart_count: 1 }),
              { type: "success" },
            );
            refresh();
          },
          onError: (err: Error) => {
            notify(
              err.message || translate("ra.notification.http_error"),
              { type: "error" },
            );
          },
        },
      );
    } else {
      // Create new custom_field_values row — use the dataProvider create
      // We use update on the parent resource with _cf_ prefix so the lifecycle hooks handle it
      await update(
        entityType,
        {
          id: record.id,
          data: { [`_cf_${fieldDef.name}`]: checked },
          previousData: record,
        },
        {
          onSuccess: () => {
            notify(
              translate("ra.notification.updated", { smart_count: 1 }),
              { type: "success" },
            );
            refresh();
          },
          onError: (err: Error) => {
            notify(
              err.message || translate("ra.notification.http_error"),
              { type: "error" },
            );
          },
        },
      );
    }
  };

  const formatValue = (
    val: unknown,
    fieldDef: CustomFieldDefinition,
  ): string => {
    if (val === null || val === undefined || val === "") return "–";
    if (fieldDef.field_type === "boolean") return val ? "Ja" : "Nein";
    if (fieldDef.field_type === "date") {
      try {
        return new Intl.DateTimeFormat("de-DE", {
          dateStyle: "medium",
        }).format(new Date(String(val)));
      } catch {
        return String(val);
      }
    }
    if (fieldDef.field_type === "datetime") {
      try {
        return new Intl.DateTimeFormat("de-DE", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(String(val)));
      } catch {
        return String(val);
      }
    }
    if (fieldDef.field_type === "currency")
      return `€ ${Number(val).toLocaleString("de-DE", { minimumFractionDigits: 2 })}`;
    if (fieldDef.field_type === "percent") return `${val} %`;
    if (fieldDef.field_type === "rating")
      return "★".repeat(Number(val) || 0);
    if (fieldDef.field_type === "select") {
      const opt = fieldDef.options?.find((o) => o.value === val);
      return opt?.label || String(val);
    }
    if (fieldDef.field_type === "multiselect") {
      const vals = Array.isArray(val) ? val : [val];
      return vals
        .map((v) => {
          const opt = fieldDef.options?.find((o) => o.value === v);
          return opt?.label || String(v);
        })
        .join(", ");
    }
    if (Array.isArray(val)) return val.join(", ");
    return String(val);
  };

  return (
    <div className="flex flex-col gap-2">
      {fieldDefs.map((fieldDef) => {
        const cfRecord = valuesByFieldId.get(fieldDef.id);
        const val = cfRecord?.value;

        if (fieldDef.field_type === "boolean") {
          return (
            <div
              key={fieldDef.id}
              className="flex items-center justify-between py-1"
            >
              <span className="text-sm text-muted-foreground">
                {fieldDef.label}
              </span>
              <div className="flex items-center gap-2">
                <Switch
                  checked={Boolean(val)}
                  disabled={isPending}
                  onCheckedChange={(checked) =>
                    handleBooleanToggle(fieldDef, checked)
                  }
                />
                <span className="text-xs text-muted-foreground w-6">
                  {val ? "Ja" : "Nein"}
                </span>
              </div>
            </div>
          );
        }

        if (fieldDef.field_type === "reference" && fieldDef.reference_object) {
          const target = fieldDef.reference_object;
          const displayField = fieldDef.reference_display_field;
          const refRecords = refDataMap[target] || [];
          const choices = refRecords.map((r) => ({
            value: String(r.id),
            label: getRefLabel(target, r, displayField),
          }));
          const currentLabel = val
            ? (choices.find((c) => c.value === String(val))?.label || String(val))
            : "–";

          return (
            <div key={fieldDef.id} className="flex items-center justify-between py-1 gap-2">
              <span className="text-sm text-muted-foreground shrink-0">
                {fieldDef.label}
              </span>
              <Select
                value={val ? String(val) : "__none__"}
                onValueChange={(v) => {
                  const newVal = v === "__none__" ? null : v;
                  saveCfValue(fieldDef, newVal);
                }}
                disabled={isPending}
              >
                <SelectTrigger className="h-8 w-auto min-w-[140px] max-w-[220px] text-sm">
                  <SelectValue placeholder="Auswählen…">
                    {val ? currentLabel : "–"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">– Keine Verknüpfung –</SelectItem>
                  {choices.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        return (
          <div key={fieldDef.id} className="flex items-center justify-between py-1">
            <span className="text-sm text-muted-foreground">
              {fieldDef.label}
            </span>
            <span className="text-sm font-medium">
              {formatValue(val, fieldDef)}
            </span>
          </div>
        );
      })}
    </div>
  );
};
