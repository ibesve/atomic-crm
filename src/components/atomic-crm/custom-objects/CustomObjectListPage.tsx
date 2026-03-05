import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import {
  useGetList,
  useCreate,
  useUpdate,
  useDelete,
  useTranslate,
  useNotify,
  useRefresh,
  useGetIdentity,
} from "ra-core";
import {
  Box,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  ArrowUpDown,
  Search,
  MoreHorizontal,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  CustomObjectDefinition,
  CustomFieldDefinition,
  CustomFieldType,
} from "../types/custom-objects";
import { CustomObjectQuickView } from "./CustomObjectQuickView";

// Icon mapping for field types
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

/**
 * Loads entries from a referenced resource and renders a Select dropdown.
 * Supports built-in resources (contacts, companies, deals, sales) and custom objects.
 */
function ReferenceFieldSelect({
  field,
  value,
  onChange,
}: {
  field: CustomFieldDefinition;
  value: unknown;
  onChange: (v: string) => void;
}) {
  const refObj = field.reference_object;
  const displayField = field.reference_display_field || "name";
  const [filterText, setFilterText] = useState("");

  // Determine the RA resource name
  const resource = useMemo(() => {
    if (!refObj) return null;
    if (refObj.startsWith("custom_")) return "custom_object_data";
    return refObj;
  }, [refObj]);

  // For custom objects, look up the definition to filter by object_definition_id
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

  const dataFilter = useMemo(() => {
    if (!resource) return { id: -1 };
    if (resource === "custom_object_data" && customDefId)
      return { object_definition_id: customDefId };
    return {};
  }, [resource, customDefId]);

  const { data: refData } = useGetList(resource ?? "contacts", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "id", order: "ASC" },
    filter: dataFilter,
  });

  const choices = useMemo(() => {
    if (!refData || !resource) return [];
    return refData.map((r: Record<string, unknown>) => {
      const id = String(r.id);
      let label: string;
      if (resource === "custom_object_data") {
        const d = (r.data || {}) as Record<string, unknown>;
        label =
          String(d[displayField] || d.name || d.title || d.label || "") ||
          `#${r.id}`;
      } else if (resource === "contacts") {
        label =
          [r.first_name, r.last_name].filter(Boolean).join(" ") || `#${r.id}`;
      } else if (resource === "sales") {
        label =
          [r.first_name, r.last_name].filter(Boolean).join(" ") || `#${r.id}`;
      } else {
        label = String(r.name || r.title || r.label || `#${r.id}`);
      }
      return { value: id, label };
    });
  }, [refData, resource, displayField]);

  const filtered = useMemo(() => {
    if (!filterText.trim()) return choices;
    const q = filterText.toLowerCase();
    return choices.filter((c) => c.label.toLowerCase().includes(q));
  }, [choices, filterText]);

  if (!refObj) {
    return (
      <p className="text-xs text-amber-600">
        Kein Referenz-Objekt konfiguriert. Bitte unter Administration → Custom Fields ein Zielobjekt zuweisen.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {choices.length > 8 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Einträge filtern…"
            className="pl-8 h-8 text-sm"
          />
        </div>
      )}
      <Select
        value={String(value ?? "")}
        onValueChange={onChange}
      >
        <SelectTrigger>
          <SelectValue placeholder="Verknüpfung auswählen…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__clear__">– Keine Verknüpfung –</SelectItem>
          {filtered.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
          {filtered.length === 0 && filterText && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Keine Einträge für "{filterText}" gefunden.
            </div>
          )}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {choices.length} {choices.length === 1 ? "Eintrag" : "Einträge"} verfügbar
      </p>
    </div>
  );
}

/**
 * Full CRUD page for a custom object type.
 * Accessed via /custom-objects/:objectName
 */
export const CustomObjectListPage = () => {
  const { objectName } = useParams<{ objectName: string }>();
  const translate = useTranslate();
  const navigate = useNavigate();
  const notify = useNotify();
  const refresh = useRefresh();
  const { identity } = useGetIdentity();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Record<string, unknown> | null>(null);
  const [deleteConfirmEntry, setDeleteConfirmEntry] = useState<Record<string, unknown> | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("DESC");
  const [quickViewEntry, setQuickViewEntry] = useState<Record<string, unknown> | null>(null);

  const [create] = useCreate();
  const [update] = useUpdate();
  const [deleteOne] = useDelete();

  // Get the object definition
  const { data: objectDefs } = useGetList<CustomObjectDefinition>(
    "custom_object_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "name", order: "ASC" },
      filter: { name: objectName },
    },
  );

  const objectDef = objectDefs?.[0];

  // Get field definitions for this custom object
  const { data: fieldDefs } = useGetList<CustomFieldDefinition>(
    "custom_field_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sort_order", order: "ASC" },
      filter: objectDef
        ? { custom_object_id: objectDef.id, "deleted_at@is": "null" }
        : { id: -1 },
    },
  );

  // Get data entries for this custom object
  const { data: entries, isPending } = useGetList(
    "custom_object_data",
    {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "id", order: "DESC" },
      filter: objectDef ? { object_definition_id: objectDef.id } : { id: -1 },
    },
  );

  // Fields to display in the table
  const displayFields = useMemo(() => {
    if (!fieldDefs) return [];
    const listFields = fieldDefs.filter((f) => f.show_in_list);
    return listFields.length > 0 ? listFields : fieldDefs.slice(0, 5);
  }, [fieldDefs]);

  // Filtered entries based on search
  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter((entry: Record<string, unknown>) => {
      const data = entry.data as Record<string, unknown> | undefined;
      if (!data) return false;
      return Object.values(data).some(
        (v) => v != null && String(v).toLowerCase().includes(q),
      );
    });
  }, [entries, searchQuery]);

  // Reset form with defaults from field definitions
  const resetForm = () => {
    const defaults: Record<string, unknown> = {};
    fieldDefs?.forEach((field) => {
      if (field.default_value != null) {
        if (field.field_type === "boolean") {
          defaults[field.name] = field.default_value === "true";
        } else if (field.field_type === "number" || field.field_type === "currency" || field.field_type === "percent") {
          defaults[field.name] = field.default_value ? Number(field.default_value) : "";
        } else {
          defaults[field.name] = field.default_value;
        }
      } else {
        defaults[field.name] = field.field_type === "boolean" ? false : "";
      }
    });
    setFormData(defaults);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (entry: Record<string, unknown>) => {
    const data = (entry.data || {}) as Record<string, unknown>;
    const values: Record<string, unknown> = {};
    fieldDefs?.forEach((field) => {
      values[field.name] = data[field.name] ?? (field.field_type === "boolean" ? false : "");
    });
    setFormData(values);
    setEditingEntry(entry);
  };

  const handleCreate = async () => {
    if (!objectDef) return;

    // Validate required fields
    const missingRequired = fieldDefs
      ?.filter((f) => f.is_required && !formData[f.name] && formData[f.name] !== false && formData[f.name] !== 0)
      .map((f) => f.label);
    if (missingRequired && missingRequired.length > 0) {
      notify(`Pflichtfelder ausfüllen: ${missingRequired.join(", ")}`, { type: "error" });
      return;
    }

    try {
      await create(
        "custom_object_data",
        {
          data: {
            object_definition_id: objectDef.id,
            data: formData,
            sales_id: identity?.id || null,
          },
        },
        { returnPromise: true },
      );
      notify(translate("crm.custom_objects.entry_created", { _: "Eintrag erstellt" }), {
        type: "success",
      });
      setIsCreateDialogOpen(false);
      resetForm();
      refresh();
    } catch (error: unknown) {
      notify(
        error instanceof Error
          ? error.message
          : translate("crm.custom_objects.error_create", { _: "Fehler beim Erstellen" }),
        { type: "error" },
      );
    }
  };

  const handleUpdate = async () => {
    if (!editingEntry || !objectDef) return;

    try {
      await update(
        "custom_object_data",
        {
          id: editingEntry.id as number,
          data: { data: formData },
          previousData: editingEntry,
        },
        { returnPromise: true },
      );
      notify(translate("crm.custom_objects.entry_updated", { _: "Eintrag aktualisiert" }), {
        type: "success",
      });
      setEditingEntry(null);
      resetForm();
      refresh();
    } catch (error: unknown) {
      notify(
        error instanceof Error
          ? error.message
          : translate("crm.custom_objects.error_update", { _: "Fehler beim Aktualisieren" }),
        { type: "error" },
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmEntry) return;

    try {
      await deleteOne(
        "custom_object_data",
        {
          id: deleteConfirmEntry.id as number,
          previousData: deleteConfirmEntry,
        },
        { returnPromise: true },
      );
      notify(translate("crm.custom_objects.entry_deleted", { _: "Eintrag gelöscht" }), {
        type: "success",
      });
      setDeleteConfirmEntry(null);
      refresh();
    } catch (error: unknown) {
      notify(
        error instanceof Error
          ? error.message
          : translate("crm.custom_objects.error_delete", { _: "Fehler beim Löschen" }),
        { type: "error" },
      );
    }
  };

  const getEntryLabel = (entry: Record<string, unknown>): string => {
    const data = entry.data as Record<string, unknown> | undefined;
    if (!data) return `#${entry.id}`;
    const display =
      data.name || data.title || data.label || data.bezeichnung || data.Name || data.Titel;
    return display ? String(display) : `#${entry.id}`;
  };

  const formatFieldValue = (value: unknown, field: CustomFieldDefinition): string => {
    if (value === null || value === undefined || value === "") return "–";
    switch (field.field_type) {
      case "boolean":
        return value ? "Ja" : "Nein";
      case "date":
        try {
          return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(String(value)));
        } catch {
          return String(value);
        }
      case "datetime":
        try {
          return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(value)));
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
  };

  // Render a single form field
  const renderFieldInput = (field: CustomFieldDefinition) => {
    const value = formData[field.name];
    const FieldIcon = FIELD_TYPE_ICON[field.field_type] || Type;

    return (
      <div key={field.name} className="space-y-1.5">
        <Label htmlFor={field.name} className="flex items-center gap-1.5 text-sm">
          <FieldIcon className="h-3.5 w-3.5 text-muted-foreground" />
          {field.label}
          {field.is_required && <span className="text-red-500">*</span>}
        </Label>

        {field.field_type === "textarea" ? (
          <Textarea
            id={field.name}
            value={String(value ?? "")}
            onChange={(e) => setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))}
            placeholder={field.placeholder || undefined}
            rows={3}
          />
        ) : field.field_type === "boolean" ? (
          <div className="flex items-center gap-2 h-9">
            <Switch
              id={field.name}
              checked={Boolean(value)}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, [field.name]: checked }))}
            />
            <span className="text-sm text-muted-foreground">
              {value ? "Ja" : "Nein"}
            </span>
          </div>
        ) : field.field_type === "select" ? (
          <Select
            value={String(value ?? "")}
            onValueChange={(v) => setFormData((prev) => ({ ...prev, [field.name]: v }))}
          >
            <SelectTrigger id={field.name}>
              <SelectValue placeholder={field.placeholder || "Auswählen..."} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : field.field_type === "multiselect" ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {(Array.isArray(value) ? value : []).map((v: string) => {
                const opt = field.options?.find((o) => o.value === v);
                return (
                  <Badge key={v} variant="secondary" className="gap-1">
                    {opt?.label || v}
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          [field.name]: ((prev[field.name] as string[]) || []).filter(
                            (x: string) => x !== v,
                          ),
                        }))
                      }
                      className="ml-0.5 hover:text-destructive"
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
                const current = (Array.isArray(value) ? value : []) as string[];
                if (!current.includes(v)) {
                  setFormData((prev) => ({ ...prev, [field.name]: [...current, v] }));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Hinzufügen..." />
              </SelectTrigger>
              <SelectContent>
                {field.options
                  ?.filter((opt) => !(Array.isArray(value) ? value : []).includes(opt.value))
                  .map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        ) : field.field_type === "reference" ? (
          <ReferenceFieldSelect
            field={field}
            value={value}
            onChange={(v) =>
              setFormData((prev) => ({
                ...prev,
                [field.name]: v === "__clear__" ? null : v,
              }))
            }
          />
        ) : field.field_type === "rating" ? (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, [field.name]: star }))}
                className={`text-lg transition-colors ${
                  Number(value) >= star ? "text-yellow-500" : "text-muted-foreground/30"
                }`}
              >
                ★
              </button>
            ))}
          </div>
        ) : (
          <Input
            id={field.name}
            type={
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
                          : "text"
            }
            value={String(value ?? "")}
            onChange={(e) => {
              const val =
                field.field_type === "number" || field.field_type === "currency" || field.field_type === "percent"
                  ? e.target.value === "" ? "" : Number(e.target.value)
                  : e.target.value;
              setFormData((prev) => ({ ...prev, [field.name]: val }));
            }}
            placeholder={field.placeholder || undefined}
          />
        )}

        {field.help_text && (
          <p className="text-xs text-muted-foreground">{field.help_text}</p>
        )}
      </div>
    );
  };

  // Not found state
  if (!objectDef && !isPending) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">
          <Box className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{translate("crm.custom_objects.not_found", { _: "Objekt nicht gefunden" })}</p>
          <Button variant="link" onClick={() => navigate(-1)}>
            {translate("ra.action.back", { _: "Zurück" })}
          </Button>
        </div>
      </div>
    );
  }

  const hasNoFields = fieldDefs && fieldDefs.length === 0;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${objectDef?.color || "#6366f1"}20` }}
          >
            <Box className="h-6 w-6" style={{ color: objectDef?.color || "#6366f1" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {objectDef?.label_plural || objectDef?.label || objectName}
            </h1>
            {objectDef?.description && (
              <p className="text-sm text-muted-foreground">{objectDef.description}</p>
            )}
          </div>
        </div>
        <Button onClick={openCreateDialog} disabled={hasNoFields}>
          <Plus className="h-4 w-4 mr-2" />
          {objectDef?.label || "Eintrag"} erstellen
        </Button>
      </div>

      {/* No fields warning */}
      {hasNoFields && (
        <Card>
          <CardContent className="py-8 text-center">
            <Type className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="font-medium mb-1">Keine Felder definiert</p>
            <p className="text-sm text-muted-foreground mb-4">
              Definieren Sie zuerst Felder unter Administration → Custom Fields, bevor Sie Einträge erstellen können.
            </p>
            <Button variant="outline" onClick={() => navigate("/admin/settings?tab=custom-fields")}>
              Zu Custom Fields
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search bar */}
      {!hasNoFields && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={translate("crm.search", { _: "Suchen..." })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="outline">
            {filteredEntries.length}{" "}
            {filteredEntries.length === 1
              ? objectDef?.label || "Eintrag"
              : objectDef?.label_plural || "Einträge"}
          </Badge>
        </div>
      )}

      {/* Table */}
      {!hasNoFields && (
        <>
          {isPending ? (
            <div className="text-center py-12 text-muted-foreground">
              {translate("ra.page.loading", { _: "Laden..." })}
            </div>
          ) : filteredEntries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Box className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium mb-1">
                  {searchQuery ? "Keine Ergebnisse gefunden" : "Keine Einträge vorhanden"}
                </p>
                {!searchQuery && (
                  <p className="text-sm">
                    Erstellen Sie den ersten {objectDef?.label || "Eintrag"}.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    {displayFields.map((field) => (
                      <TableHead
                        key={field.id}
                        className="cursor-pointer select-none"
                        onClick={() => {
                          if (sortField === field.name) {
                            setSortOrder((o) => (o === "ASC" ? "DESC" : "ASC"));
                          } else {
                            setSortField(field.name);
                            setSortOrder("ASC");
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          {field.label}
                          {sortField === field.name && (
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          )}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead>
                      {translate("crm.created_at", { _: "Erstellt" })}
                    </TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...filteredEntries]
                    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
                      const aData = (a.data || {}) as Record<string, unknown>;
                      const bData = (b.data || {}) as Record<string, unknown>;
                      const aVal = aData[sortField] ?? a[sortField] ?? "";
                      const bVal = bData[sortField] ?? b[sortField] ?? "";
                      const cmp = String(aVal).localeCompare(String(bVal), "de");
                      return sortOrder === "ASC" ? cmp : -cmp;
                    })
                    .map((entry: Record<string, unknown>) => {
                      const data = (entry.data || {}) as Record<string, unknown>;
                      return (
                        <TableRow
                          key={entry.id as number}
                          className="group cursor-pointer hover:bg-accent/50"
                          onClick={() => setQuickViewEntry(entry)}
                        >
                          {displayFields.map((field) => (
                            <TableCell key={field.id}>
                              {formatFieldValue(data[field.name], field)}
                            </TableCell>
                          ))}
                          <TableCell className="text-muted-foreground text-sm">
                            {entry.created_at
                              ? new Intl.DateTimeFormat("de-DE", {
                                  dateStyle: "medium",
                                }).format(new Date(entry.created_at as string))
                              : "–"}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setQuickViewEntry(entry); }}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  QuickView
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(entry); }}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Bearbeiten
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => { e.stopPropagation(); setDeleteConfirmEntry(entry); }}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Löschen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={isCreateDialogOpen || !!editingEntry}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingEntry(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEntry
                ? `${objectDef?.label || "Eintrag"} bearbeiten`
                : `${objectDef?.label || "Eintrag"} erstellen`}
            </DialogTitle>
            <DialogDescription>
              {editingEntry
                ? "Bearbeiten Sie die Felder und speichern Sie."
                : "Füllen Sie die Felder aus, um einen neuen Eintrag zu erstellen."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {fieldDefs?.map((field) => renderFieldInput(field))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setEditingEntry(null);
                resetForm();
              }}
            >
              <X className="h-4 w-4 mr-2" />
              {translate("crm.cancel", { _: "Abbrechen" })}
            </Button>
            <Button onClick={editingEntry ? handleUpdate : handleCreate}>
              <Save className="h-4 w-4 mr-2" />
              {editingEntry
                ? translate("crm.save", { _: "Speichern" })
                : translate("crm.create", { _: "Erstellen" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QuickView Sheet */}
      <CustomObjectQuickView
        open={!!quickViewEntry}
        onOpenChange={(open) => !open && setQuickViewEntry(null)}
        entry={quickViewEntry}
        objectDef={objectDef || null}
        fieldDefs={fieldDefs || []}
        onDelete={(e) => setDeleteConfirmEntry(e)}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteConfirmEntry}
        onOpenChange={(open) => !open && setDeleteConfirmEntry(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eintrag löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie &quot;{getEntryLabel(deleteConfirmEntry || {})}&quot; wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {translate("crm.cancel", { _: "Abbrechen" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {translate("crm.delete", { _: "Löschen" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CustomObjectListPage;
