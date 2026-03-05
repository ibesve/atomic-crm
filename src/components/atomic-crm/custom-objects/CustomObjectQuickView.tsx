/**
 * QuickView sheet for custom object records.
 *
 * Opens as a right-side panel when a row is clicked.
 * All fields are rendered with inline-editing controls:
 *   - boolean  → Switch
 *   - select   → Select dropdown
 *   - multiselect → badge list + dropdown
 *   - reference → Select dropdown with data from the referenced resource
 *   - rating   → star buttons
 *   - date / datetime → native date picker
 *   - others   → Input (text / number / email / …)
 *
 * Changes are auto-saved on blur / change.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  useGetList,
  useUpdate,
  useTranslate,
  useNotify,
  useRefresh,
} from "ra-core";
import {
  Calendar,
  Hash,
  Type,
  ToggleLeft,
  List,
  Mail,
  Phone,
  Globe,
  AlignLeft,
  DollarSign,
  Percent,
  Star,
  Link,
  CheckSquare,
  Clock,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type {
  CustomFieldDefinition,
  CustomFieldType,
  CustomObjectDefinition,
} from "../types/custom-objects";

// ─── Icon map ──────────────────────────────────────────────────────────
const FIELD_TYPE_ICON: Record<CustomFieldType, React.ElementType> = {
  text: Type,
  number: Hash,
  date: Calendar,
  datetime: Clock,
  boolean: ToggleLeft,
  select: List,
  multiselect: CheckSquare,
  reference: Link,
  email: Mail,
  phone: Phone,
  url: Globe,
  textarea: AlignLeft,
  currency: DollarSign,
  percent: Percent,
  rating: Star,
};

// ─── Reference data hook ───────────────────────────────────────────────
/**
 * Loads records for a reference field so we can build a <Select>.
 * Supports built-in resources (contacts, companies, deals, sales)
 * and custom objects (prefixed "custom_").
 */
function useReferenceData(field: CustomFieldDefinition) {
  const refObj = field.reference_object;
  const displayField = field.reference_display_field || "name";

  // Determine RA resource name
  const resource = useMemo(() => {
    if (!refObj) return null;
    if (refObj.startsWith("custom_")) return "custom_object_data";
    return refObj; // contacts, companies, deals, sales …
  }, [refObj]);

  // For custom objects we need the definition to filter by object_definition_id
  const { data: customDefs } = useGetList<CustomObjectDefinition>(
    "custom_object_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "name", order: "ASC" },
      filter: refObj?.startsWith("custom_")
        ? { name: refObj.replace("custom_", "") }
        : { id: -1 },
    },
  );
  const customDefId = customDefs?.[0]?.id;

  const filter = useMemo(() => {
    if (!resource) return { id: -1 };
    if (resource === "custom_object_data" && customDefId) {
      return { object_definition_id: customDefId };
    }
    return {};
  }, [resource, customDefId]);

  const { data } = useGetList(resource ?? "contacts", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "id", order: "ASC" },
    filter,
  });

  // Map to { value, label } list
  return useMemo(() => {
    if (!data || !resource) return [];
    return data.map((r: Record<string, unknown>) => {
      const id = String(r.id);
      let label: string;
      if (resource === "custom_object_data") {
        const d = (r.data || {}) as Record<string, unknown>;
        label =
          String(
            d[displayField] ||
              d.name ||
              d.title ||
              d.label ||
              d.bezeichnung ||
              "",
          ) || `#${r.id}`;
      } else if (resource === "contacts") {
        label = [r.first_name, r.last_name].filter(Boolean).join(" ") || `#${r.id}`;
      } else if (resource === "companies") {
        label = String(r.name || `#${r.id}`);
      } else if (resource === "deals") {
        label = String(r.name || `#${r.id}`);
      } else if (resource === "sales") {
        label = [r.first_name, r.last_name].filter(Boolean).join(" ") || `#${r.id}`;
      } else {
        label = String(r.name || r.title || r.label || `#${r.id}`);
      }
      return { value: id, label };
    });
  }, [data, resource, displayField]);
}

// ─── Inline editable field ─────────────────────────────────────────────
interface InlineFieldProps {
  field: CustomFieldDefinition;
  value: unknown;
  onChange: (name: string, value: unknown) => void;
}

function InlineField({ field, value, onChange }: InlineFieldProps) {
  const FieldIcon = FIELD_TYPE_ICON[field.field_type] || Type;
  const referenceChoices = useReferenceData(field);

  // Local editing state for text-like fields (commit on blur / Enter)
  const [localValue, setLocalValue] = useState(String(value ?? ""));
  const [isTextEditing, setIsTextEditing] = useState(false);

  // Stay in sync with external value
  useEffect(() => {
    if (!isTextEditing) setLocalValue(String(value ?? ""));
  }, [value, isTextEditing]);

  const commitText = useCallback(() => {
    setIsTextEditing(false);
    const coerced =
      field.field_type === "number" ||
      field.field_type === "currency" ||
      field.field_type === "percent"
        ? localValue === ""
          ? ""
          : Number(localValue)
        : localValue;
    if (coerced !== value) onChange(field.name, coerced);
  }, [localValue, value, field, onChange]);

  // ── Boolean ────────────────────────────────────────────────────────
  if (field.field_type === "boolean") {
    return (
      <div className="flex items-center justify-between py-2 group">
        <Label className="flex items-center gap-1.5 text-sm font-normal text-muted-foreground">
          <FieldIcon className="h-3.5 w-3.5" />
          {field.label}
        </Label>
        <Switch
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(field.name, checked)}
        />
      </div>
    );
  }

  // ── Select ─────────────────────────────────────────────────────────
  if (field.field_type === "select") {
    return (
      <div className="space-y-1 py-2">
        <Label className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
          <FieldIcon className="h-3.5 w-3.5" />
          {field.label}
        </Label>
        <Select
          value={String(value ?? "")}
          onValueChange={(v) => onChange(field.name, v === "__clear__" ? "" : v)}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="–" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__clear__">–</SelectItem>
            {field.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span className="flex items-center gap-2">
                  {opt.color && (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: opt.color }}
                    />
                  )}
                  {opt.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // ── Multiselect ────────────────────────────────────────────────────
  if (field.field_type === "multiselect") {
    const current = (Array.isArray(value) ? value : []) as string[];
    return (
      <div className="space-y-1.5 py-2">
        <Label className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
          <FieldIcon className="h-3.5 w-3.5" />
          {field.label}
        </Label>
        <div className="flex flex-wrap gap-1">
          {current.map((v) => {
            const opt = field.options?.find((o) => o.value === v);
            return (
              <Badge key={v} variant="secondary" className="gap-1 text-xs">
                {opt?.label || v}
                <button
                  type="button"
                  className="ml-0.5 hover:text-destructive"
                  onClick={() =>
                    onChange(
                      field.name,
                      current.filter((x) => x !== v),
                    )
                  }
                >
                  ×
                </button>
              </Badge>
            );
          })}
        </div>
        <Select
          value=""
          onValueChange={(v) => {
            if (!current.includes(v)) {
              onChange(field.name, [...current, v]);
            }
          }}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Hinzufügen…" />
          </SelectTrigger>
          <SelectContent>
            {field.options
              ?.filter((opt) => !current.includes(opt.value))
              .map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // ── Reference ──────────────────────────────────────────────────────
  if (field.field_type === "reference") {
    return (
      <div className="space-y-1 py-2">
        <Label className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
          <FieldIcon className="h-3.5 w-3.5" />
          {field.label}
        </Label>
        <Select
          value={String(value ?? "")}
          onValueChange={(v) => onChange(field.name, v === "__clear__" ? "" : v)}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="–" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__clear__">–</SelectItem>
            {referenceChoices.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // ── Rating ─────────────────────────────────────────────────────────
  if (field.field_type === "rating") {
    return (
      <div className="space-y-1 py-2">
        <Label className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
          <FieldIcon className="h-3.5 w-3.5" />
          {field.label}
        </Label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(field.name, star === Number(value) ? 0 : star)}
              className={`text-lg transition-colors ${
                Number(value) >= star
                  ? "text-yellow-500"
                  : "text-muted-foreground/30 hover:text-yellow-300"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Textarea ───────────────────────────────────────────────────────
  if (field.field_type === "textarea") {
    return (
      <div className="space-y-1 py-2">
        <Label className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
          <FieldIcon className="h-3.5 w-3.5" />
          {field.label}
        </Label>
        {isTextEditing ? (
          <div className="space-y-1">
            <Textarea
              autoFocus
              value={localValue}
              rows={3}
              onChange={(e) => setLocalValue(e.target.value)}
              onBlur={commitText}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setLocalValue(String(value ?? ""));
                  setIsTextEditing(false);
                }
              }}
              placeholder={field.placeholder || undefined}
            />
            <div className="flex gap-1 justify-end">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setLocalValue(String(value ?? ""));
                  setIsTextEditing(false);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={commitText}
              >
                <Check className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="text-sm min-h-[2rem] px-2 py-1 rounded border border-transparent hover:border-border cursor-pointer whitespace-pre-wrap"
            onClick={() => setIsTextEditing(true)}
          >
            {value ? String(value) : <span className="text-muted-foreground">–</span>}
            <Pencil className="h-3 w-3 inline-block ml-1 opacity-0 group-hover:opacity-50" />
          </div>
        )}
      </div>
    );
  }

  // ── Text-like (text, number, email, phone, url, date, datetime, currency, percent) ──
  const inputType =
    field.field_type === "number" || field.field_type === "currency" || field.field_type === "percent"
      ? "number"
      : field.field_type === "date"
        ? "date"
        : field.field_type === "datetime"
          ? "datetime-local"
          : field.field_type === "email"
            ? "email"
            : field.field_type === "url"
              ? "url"
              : field.field_type === "phone"
                ? "tel"
                : "text";

  return (
    <div className="space-y-1 py-2">
      <Label className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
        <FieldIcon className="h-3.5 w-3.5" />
        {field.label}
      </Label>
      {isTextEditing ? (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            type={inputType}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitText();
              if (e.key === "Escape") {
                setLocalValue(String(value ?? ""));
                setIsTextEditing(false);
              }
            }}
            placeholder={field.placeholder || undefined}
            className="h-8"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={() => {
              setLocalValue(String(value ?? ""));
              setIsTextEditing(false);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div
          className="text-sm min-h-[2rem] flex items-center px-2 py-1 rounded border border-transparent hover:border-border cursor-pointer group"
          onClick={() => setIsTextEditing(true)}
        >
          <span className="flex-1 truncate">
            {value != null && value !== ""
              ? formatDisplayValue(value, field)
              : <span className="text-muted-foreground">–</span>}
          </span>
          <Pencil className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
        </div>
      )}
    </div>
  );
}

// ─── Display formatter (read-only view) ────────────────────────────────
function formatDisplayValue(value: unknown, field: CustomFieldDefinition): string {
  if (value === null || value === undefined || value === "") return "–";
  switch (field.field_type) {
    case "boolean":
      return value ? "Ja" : "Nein";
    case "date":
      try {
        return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(
          new Date(String(value)),
        );
      } catch {
        return String(value);
      }
    case "datetime":
      try {
        return new Intl.DateTimeFormat("de-DE", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(String(value)));
      } catch {
        return String(value);
      }
    case "currency":
      return `€ ${Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2 })}`;
    case "percent":
      return `${value} %`;
    case "rating":
      return "★".repeat(Number(value) || 0);
    case "select": {
      const opt = field.options?.find((o) => o.value === value);
      return opt?.label || String(value);
    }
    case "multiselect": {
      const vals = Array.isArray(value) ? value : [value];
      return vals
        .map((v) => {
          const opt = field.options?.find((o) => o.value === v);
          return opt?.label || String(v);
        })
        .join(", ");
    }
    default:
      return String(value);
  }
}

// ─── QuickView Sheet ───────────────────────────────────────────────────
export interface CustomObjectQuickViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: Record<string, unknown> | null;
  objectDef: CustomObjectDefinition | null;
  fieldDefs: CustomFieldDefinition[];
  onDelete?: (entry: Record<string, unknown>) => void;
}

export function CustomObjectQuickView({
  open,
  onOpenChange,
  entry,
  objectDef,
  fieldDefs,
  onDelete,
}: CustomObjectQuickViewProps) {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [update, { isPending: isSaving }] = useUpdate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Local data mirror so we can show optimistic updates
  const [localData, setLocalData] = useState<Record<string, unknown>>({});

  // Sync from entry when it changes
  useEffect(() => {
    if (entry) {
      setLocalData(((entry.data || {}) as Record<string, unknown>));
    }
  }, [entry]);

  const handleFieldChange = useCallback(
    async (fieldName: string, newValue: unknown) => {
      if (!entry) return;

      // Optimistic local update
      setLocalData((prev) => ({ ...prev, [fieldName]: newValue }));

      try {
        await update(
          "custom_object_data",
          {
            id: entry.id as number,
            data: {
              data: { ...localData, [fieldName]: newValue },
            },
            previousData: entry,
          },
          { returnPromise: true },
        );
        refresh();
      } catch (error: unknown) {
        // Revert on failure
        setLocalData(((entry.data || {}) as Record<string, unknown>));
        notify(
          error instanceof Error
            ? error.message
            : translate("crm.custom_objects.error_update", {
                _: "Fehler beim Speichern",
              }),
          { type: "error" },
        );
      }
    },
    [entry, localData, update, refresh, notify, translate],
  );

  if (!entry || !objectDef) return null;

  const entryLabel = (() => {
    const d = localData;
    const display =
      d.name || d.title || d.label || d.bezeichnung || d.Name || d.Titel;
    return display ? String(display) : `#${entry.id}`;
  })();

  // Group fields by field_group
  const grouped = fieldDefs.reduce(
    (acc, field) => {
      const group = field.field_group || "";
      if (!acc[group]) acc[group] = [];
      acc[group].push(field);
      return acc;
    },
    {} as Record<string, CustomFieldDefinition[]>,
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div
                className="p-1.5 rounded"
                style={{
                  backgroundColor: `${objectDef.color || "#6366f1"}20`,
                }}
              >
                <div
                  className="h-4 w-4 rounded-sm"
                  style={{ backgroundColor: objectDef.color || "#6366f1" }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="truncate text-base">
                  {entryLabel}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {objectDef.label} #{entry.id as number}
                  {isSaving && (
                    <Loader2 className="inline-block h-3 w-3 ml-1 animate-spin" />
                  )}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <Separator className="my-2" />

          {/* Fields grouped */}
          <div className="space-y-1">
            {Object.entries(grouped).map(([group, fields]) => (
              <div key={group}>
                {group && (
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-4 mb-1">
                    {group}
                  </p>
                )}
                {fields.map((field) => (
                  <InlineField
                    key={field.id}
                    field={field}
                    value={localData[field.name]}
                    onChange={handleFieldChange}
                  />
                ))}
              </div>
            ))}
          </div>

          <Separator className="my-3" />

          {/* Meta info */}
          <div className="text-xs text-muted-foreground space-y-1">
            {typeof entry.created_at === "string" && (
              <p>
                Erstellt:{" "}
                {new Intl.DateTimeFormat("de-DE", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(entry.created_at))}
              </p>
            )}
            {typeof entry.updated_at === "string" && (
              <p>
                Aktualisiert:{" "}
                {new Intl.DateTimeFormat("de-DE", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(entry.updated_at))}
              </p>
            )}
          </div>

          <Separator className="my-3" />

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Löschen
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eintrag löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie &quot;{entryLabel}&quot; wirklich löschen? Diese
              Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                setShowDeleteConfirm(false);
                onOpenChange(false);
                onDelete?.(entry);
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default CustomObjectQuickView;
