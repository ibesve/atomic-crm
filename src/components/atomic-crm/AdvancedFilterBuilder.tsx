/**
 * AdvancedFilterBuilder — Row-based filter builder with AND/OR logic.
 *
 * Each row is a (field, operator, value) triple. Rows can be grouped
 * with AND or OR logic. The output is a SavedViewFilters object that
 * can be converted to PostgREST filter params.
 */
import { useState, useCallback, useMemo } from "react";
import { Plus, Trash2, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SavedViewFilter, SavedViewFilters } from "./types/custom-objects";

// ── Operator Definitions ───────────────────────────────────

interface OperatorDef {
  value: SavedViewFilter["operator"];
  label: string;
  /** Which field types this operator applies to */
  types: string[];
  /** Whether this operator requires a value input */
  needsValue: boolean;
}

const OPERATORS: OperatorDef[] = [
  { value: "eq", label: "gleich", types: ["text", "number", "select", "boolean", "date", "datetime", "reference", "currency", "percent", "rating", "email", "phone", "url"], needsValue: true },
  { value: "neq", label: "ungleich", types: ["text", "number", "select", "boolean", "date", "datetime", "reference", "currency", "percent", "rating"], needsValue: true },
  { value: "gt", label: "größer als", types: ["number", "date", "datetime", "currency", "percent", "rating"], needsValue: true },
  { value: "gte", label: "≥", types: ["number", "date", "datetime", "currency", "percent", "rating"], needsValue: true },
  { value: "lt", label: "kleiner als", types: ["number", "date", "datetime", "currency", "percent", "rating"], needsValue: true },
  { value: "lte", label: "≤", types: ["number", "date", "datetime", "currency", "percent", "rating"], needsValue: true },
  { value: "like", label: "enthält", types: ["text", "textarea", "email", "phone", "url"], needsValue: true },
  { value: "ilike", label: "enthält (ign. Groß/Klein)", types: ["text", "textarea", "email", "phone", "url"], needsValue: true },
  { value: "is", label: "ist null", types: ["text", "number", "select", "date", "datetime", "reference", "email", "phone", "url", "textarea", "currency", "percent", "rating"], needsValue: false },
  { value: "not.is", label: "ist nicht null", types: ["text", "number", "select", "date", "datetime", "reference", "email", "phone", "url", "textarea", "currency", "percent", "rating"], needsValue: false },
  { value: "in", label: "in Liste", types: ["select", "multiselect"], needsValue: true },
  { value: "cs", label: "enthält alle", types: ["multiselect"], needsValue: true },
  { value: "cd", label: "enthalten in", types: ["multiselect"], needsValue: true },
];

// ── Field Definition for Filter ─────────────────────────────

export interface FilterFieldDef {
  /** The field source (column name or _cf_fieldname) */
  source: string;
  /** Human-readable label */
  label: string;
  /** Field type for operator selection */
  type: string;
  /** Options for select/multiselect fields */
  options?: { value: string; label: string }[];
  /** Reference data for reference fields (dropdown items) */
  referenceData?: { id: string | number; name?: string; first_name?: string; last_name?: string; [key: string]: unknown }[];
}

// ── Component Props ─────────────────────────────────────────

interface AdvancedFilterBuilderProps {
  /** Available fields to filter on */
  fields: FilterFieldDef[];
  /** Current filter state */
  filters: SavedViewFilters;
  /** Called when filters change */
  onChange: (filters: SavedViewFilters) => void;
  /** Compact mode — just the trigger button */
  compact?: boolean;
}

// ── Helper: empty rule ──────────────────────────────────────

const createEmptyRule = (): SavedViewFilter => ({
  field: "",
  operator: "eq",
  value: "",
});

// ── Main Component ──────────────────────────────────────────

export const AdvancedFilterBuilder = ({
  fields,
  filters,
  onChange,
  compact = false,
}: AdvancedFilterBuilderProps) => {
  const [open, setOpen] = useState(false);

  const activeCount = filters.rules.filter((r: SavedViewFilter) => r.field).length;

  const addRule = useCallback(() => {
    onChange({
      ...filters,
      rules: [...filters.rules, createEmptyRule()],
    });
  }, [filters, onChange]);

  const removeRule = useCallback(
    (index: number) => {
      const newRules = filters.rules.filter((_: SavedViewFilter, i: number) => i !== index);
      onChange({ ...filters, rules: newRules.length > 0 ? newRules : [createEmptyRule()] });
    },
    [filters, onChange],
  );

  const updateRule = useCallback(
    (index: number, patch: Partial<SavedViewFilter>) => {
      const newRules = [...filters.rules];
      newRules[index] = { ...newRules[index], ...patch };
      // When field changes, reset operator and value
      if (patch.field !== undefined) {
        const fieldDef = fields.find((f) => f.source === patch.field);
        const validOps = OPERATORS.filter((op) => fieldDef && op.types.includes(fieldDef.type));
        if (validOps.length > 0 && !validOps.find((op) => op.value === newRules[index].operator)) {
          newRules[index].operator = validOps[0].value;
        }
        newRules[index].value = "";
      }
      onChange({ ...filters, rules: newRules });
    },
    [filters, fields, onChange],
  );

  const toggleLogic = useCallback(() => {
    onChange({ ...filters, logic: filters.logic === "and" ? "or" : "and" });
  }, [filters, onChange]);

  const clearAll = useCallback(() => {
    onChange({ logic: "and", rules: [createEmptyRule()] });
  }, [onChange]);

  const trigger = (
    <Button variant={activeCount > 0 ? "default" : "outline"} size="sm" className="gap-1.5">
      <Filter className="h-3.5 w-3.5" />
      Filter
      {activeCount > 0 && (
        <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-xs">
          {activeCount}
        </Badge>
      )}
    </Button>
  );

  const content = (
    <div className="space-y-3 p-1">
      {/* Logic toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Verknüpfung:</span>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={toggleLogic}
        >
          {filters.logic === "and" ? "UND (alle)" : "ODER (mind. eine)"}
        </Button>
      </div>

      {/* Filter rows */}
      <div className="space-y-2">
        {filters.rules.map((rule: SavedViewFilter, index: number) => (
          <FilterRow
            key={index}
            rule={rule}
            fields={fields}
            index={index}
            onChange={updateRule}
            onRemove={removeRule}
            showLogicLabel={index > 0}
            logic={filters.logic}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1 border-t">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addRule}>
          <Plus className="h-3 w-3" /> Regel hinzufügen
        </Button>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive" onClick={clearAll}>
            <X className="h-3 w-3" /> Alle löschen
          </Button>
        )}
      </div>
    </div>
  );

  if (compact) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className="w-[520px]" align="start">
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  return content;
};

// ── Single Filter Row ──────────────────────────────────────

interface FilterRowProps {
  rule: SavedViewFilter;
  fields: FilterFieldDef[];
  index: number;
  onChange: (index: number, patch: Partial<SavedViewFilter>) => void;
  onRemove: (index: number) => void;
  showLogicLabel: boolean;
  logic: "and" | "or";
}

const FilterRow = ({
  rule,
  fields,
  index,
  onChange,
  onRemove,
  showLogicLabel,
  logic,
}: FilterRowProps) => {
  const fieldDef = fields.find((f) => f.source === rule.field);
  const fieldType = fieldDef?.type || "text";

  const validOperators = useMemo(
    () => OPERATORS.filter((op) => op.types.includes(fieldType)),
    [fieldType],
  );

  const currentOp = OPERATORS.find((op) => op.value === rule.operator);

  return (
    <div className="flex items-center gap-1.5">
      {/* Logic label */}
      {showLogicLabel && (
        <span className="text-xs text-muted-foreground w-8 text-center shrink-0">
          {logic === "and" ? "UND" : "ODER"}
        </span>
      )}
      {!showLogicLabel && <span className="w-8 shrink-0" />}

      {/* Field selector */}
      <Select value={rule.field || "__none__"} onValueChange={(v) => onChange(index, { field: v === "__none__" ? "" : v })}>
        <SelectTrigger className="h-8 w-[140px] text-xs">
          <SelectValue placeholder="Feld…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__" disabled>Feld wählen…</SelectItem>
          {fields.map((f) => (
            <SelectItem key={f.source} value={f.source}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator selector */}
      <Select value={rule.operator} onValueChange={(v) => onChange(index, { operator: v as SavedViewFilter["operator"] })}>
        <SelectTrigger className="h-8 w-[130px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {validOperators.map((op) => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input */}
      {currentOp?.needsValue !== false && (
        <ValueInput
          rule={rule}
          fieldDef={fieldDef}
          onChange={(value) => onChange(index, { value })}
        />
      )}

      {/* Remove button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(index)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

// ── Value Input (type-aware) ────────────────────────────────

interface ValueInputProps {
  rule: SavedViewFilter;
  fieldDef?: FilterFieldDef;
  onChange: (value: unknown) => void;
}

const ValueInput = ({ rule, fieldDef, onChange }: ValueInputProps) => {
  const type = fieldDef?.type || "text";

  // Reference → dropdown from referenceData
  if (type === "reference" && fieldDef?.referenceData && fieldDef.referenceData.length > 0) {
    return (
      <Select value={String(rule.value || "")} onValueChange={onChange}>
        <SelectTrigger className="h-8 flex-1 min-w-[120px] text-xs">
          <SelectValue placeholder="Wert…" />
        </SelectTrigger>
        <SelectContent>
          {fieldDef.referenceData.map((item) => (
            <SelectItem key={item.id} value={String(item.id)}>
              {item.name || (item.first_name
                ? `${item.first_name} ${item.last_name}`
                : String(item.id))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Select/multiselect → dropdown from options
  if ((type === "select" || type === "multiselect") && fieldDef?.options && fieldDef.options.length > 0) {
    return (
      <Select value={String(rule.value || "")} onValueChange={onChange}>
        <SelectTrigger className="h-8 flex-1 min-w-[100px] text-xs">
          <SelectValue placeholder="Wert…" />
        </SelectTrigger>
        <SelectContent>
          {fieldDef.options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Boolean
  if (type === "boolean") {
    return (
      <Select value={String(rule.value || "")} onValueChange={onChange}>
        <SelectTrigger className="h-8 flex-1 min-w-[80px] text-xs">
          <SelectValue placeholder="Wert…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Ja</SelectItem>
          <SelectItem value="false">Nein</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  // Date
  if (type === "date" || type === "datetime") {
    return (
      <Input
        type={type === "datetime" ? "datetime-local" : "date"}
        value={String(rule.value || "")}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 flex-1 min-w-[120px] text-xs"
      />
    );
  }

  // Number, currency, percent, rating
  if (type === "number" || type === "currency" || type === "percent" || type === "rating") {
    return (
      <Input
        type="number"
        value={String(rule.value || "")}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 flex-1 min-w-[80px] text-xs"
        placeholder="Wert…"
      />
    );
  }

  // Fallback: text input
  return (
    <Input
      value={String(rule.value || "")}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 flex-1 min-w-[100px] text-xs"
      placeholder="Wert…"
    />
  );
};

// ── PostgREST Filter Conversion ─────────────────────────────

/**
 * Convert SavedViewFilters to a PostgREST-compatible filter object.
 * For AND logic: { "field@op": value, ... }
 * For OR logic: uses PostgREST `or` operator syntax.
 *
 * Custom field filters (_cf_* fields) are EXCLUDED because they don't
 * exist as columns on the PostgreSQL views (e.g. contacts_summary).
 * Use buildCFClientFilter() instead to apply those client-side.
 */
export function filtersToPostgREST(filters: SavedViewFilters): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const activeRules = filters.rules.filter((r: SavedViewFilter) => r.field);

  if (activeRules.length === 0) return result;

  // Separate server-compatible rules from custom-field rules
  const serverRules = activeRules.filter((r) => !r.field.startsWith("_cf_"));
  const hasCFRules = activeRules.some((r) => r.field.startsWith("_cf_"));

  if (filters.logic === "and") {
    // AND: we can safely send non-CF rules to PostgREST and apply CF rules client-side
    for (const rule of serverRules) {
      const key = `${rule.field}@${rule.operator}`;
      if (rule.operator === "is" || rule.operator === "not.is") {
        result[key] = "null";
      } else if (rule.operator === "like" || rule.operator === "ilike") {
        result[key] = `%${rule.value}%`;
      } else {
        result[key] = rule.value;
      }
    }
  } else {
    // OR logic: if any CF rules are mixed in, we can't send partial OR to PostgREST
    // because we'd miss records matching CF rules. Fetch all and filter client-side.
    if (hasCFRules) {
      // Return empty filter — all filtering happens client-side via buildCFClientFilter
      return result;
    }
    const clauses = serverRules.map((rule: SavedViewFilter) => {
      if (rule.operator === "is" || rule.operator === "not.is") {
        return `${rule.field}.${rule.operator}.null`;
      }
      if (rule.operator === "like" || rule.operator === "ilike") {
        return `${rule.field}.${rule.operator}.%25${rule.value}%25`;
      }
      return `${rule.field}.${rule.operator}.${rule.value}`;
    });
    if (clauses.length > 0) {
      result["or"] = `(${clauses.join(",")})`;
    }
  }

  return result;
}

/**
 * Build a client-side predicate function for custom-field (_cf_*) filter rules.
 * Returns null if no CF filters are active.
 *
 * For OR logic with mixed CF and non-CF rules, ALL rules are evaluated
 * client-side (both _cf_ and regular fields) since they can't be split.
 */
export function buildCFClientFilter(
  filters: SavedViewFilters,
  cfLookup?: Record<string, Record<number, unknown>>,
): ((record: Record<string, unknown>) => boolean) | null {
  const activeRules = filters.rules.filter((r: SavedViewFilter) => r.field);
  if (activeRules.length === 0) return null;

  const cfRules = activeRules.filter((r) => r.field.startsWith("_cf_"));
  if (cfRules.length === 0 && filters.logic === "and") return null;

  // For OR logic with CF rules, we need to evaluate ALL rules client-side
  const rulesToEvaluate =
    filters.logic === "or" && cfRules.length > 0 ? activeRules : cfRules;

  if (rulesToEvaluate.length === 0) return null;

  const matchesRule = (record: Record<string, unknown>, rule: SavedViewFilter): boolean => {
    // For _cf_* fields, prefer the bulk-loaded cfLookup over record fields.
    // afterRead/mergeCustomFieldValues can fail silently for getList (200 API calls),
    // so we use the values from useCustomFieldColumns' bulk query instead.
    let val: unknown;
    if (cfLookup && rule.field.startsWith("_cf_")) {
      const lookup = cfLookup[rule.field];
      val = lookup?.[record.id as number];
    } else {
      val = record[rule.field];
    }
    const target = rule.value;

    switch (rule.operator) {
      case "eq":
        return String(val ?? "") === String(target ?? "");
      case "neq":
        return String(val ?? "") !== String(target ?? "");
      case "gt":
        return Number(val) > Number(target);
      case "gte":
        return Number(val) >= Number(target);
      case "lt":
        return Number(val) < Number(target);
      case "lte":
        return Number(val) <= Number(target);
      case "like":
        return String(val ?? "")
          .includes(String(target ?? ""));
      case "ilike":
        return String(val ?? "")
          .toLowerCase()
          .includes(String(target ?? "").toLowerCase());
      case "is":
        return val == null;
      case "not.is":
        return val != null;
      case "in": {
        const arr = Array.isArray(target)
          ? target.map(String)
          : String(target ?? "").split(",");
        return arr.includes(String(val ?? ""));
      }
      case "cs":
        // contains — array/jsonb contains
        if (Array.isArray(val) && Array.isArray(target)) {
          return target.every((t: unknown) => (val as unknown[]).includes(t));
        }
        return String(val ?? "").includes(String(target ?? ""));
      case "cd":
        // contained by
        if (Array.isArray(val) && Array.isArray(target)) {
          return (val as unknown[]).every((v: unknown) => (target as unknown[]).includes(v));
        }
        return String(target ?? "").includes(String(val ?? ""));
      default:
        return true;
    }
  };

  return (record: Record<string, unknown>) => {
    if (filters.logic === "and") {
      return rulesToEvaluate.every((rule) => matchesRule(record, rule));
    }
    // OR logic: at least one rule must match
    return rulesToEvaluate.some((rule) => matchesRule(record, rule));
  };
}

export default AdvancedFilterBuilder;
