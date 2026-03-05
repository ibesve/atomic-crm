import { useState } from "react";
import {
  useGetList,
  useCreate,
  useUpdate,
  useNotify,
  useRefresh,
  useTranslate,
} from "ra-core";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Save,
  X,
  Type,
  Hash,
  Calendar,
  Clock,
  ToggleLeft,
  List,
  CheckSquare,
  Link,
  Mail,
  Phone,
  Globe,
  AlignLeft,
  DollarSign,
  Percent,
  Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  CustomFieldDefinition,
  CustomFieldFormData,
  CustomFieldType,
  CustomObjectDefinition,
  SelectOption,
} from "../types/custom-objects";
import { FIELD_TYPE_LABELS } from "../types/custom-objects";

// Icons für Feldtypen
const FIELD_TYPE_ICONS: Record<CustomFieldType, React.ElementType> = {
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

const DEFAULT_FORM_DATA: CustomFieldFormData = {
  name: "",
  label: "",
  description: "",
  field_type: "text",
  is_required: false,
  is_unique: false,
  default_value: "",
  options: [],
  reference_object: "",
  reference_display_field: "",
  placeholder: "",
  help_text: "",
  show_in_list: true,
  show_in_detail: true,
  column_width: 150,
  field_group: "",
};

interface CustomFieldsManagerProps {
  customObjectId?: number;
  customObjectName?: string;
  entityType?: "contacts" | "companies" | "deals";
}

export function CustomFieldsManager({
  customObjectId,
  customObjectName,
  entityType,
}: CustomFieldsManagerProps) {
  const notify = useNotify();
  const refresh = useRefresh();
  const translate = useTranslate();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingField, setEditingField] =
    useState<CustomFieldDefinition | null>(null);
  const [deleteConfirmField, setDeleteConfirmField] =
    useState<CustomFieldDefinition | null>(null);
  const [formData, setFormData] =
    useState<CustomFieldFormData>(DEFAULT_FORM_DATA);
  const [newOption, setNewOption] = useState("");

  // Load custom object definitions for reference field type
  const { data: allCustomObjects } = useGetList<CustomObjectDefinition>(
    "custom_object_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "label", order: "ASC" },
      filter: { "deleted_at@is": "null", is_active: true },
    }
  );

  // Filter basierend auf customObjectId oder entityType
  const filter: Record<string, unknown> = { "deleted_at@is": "null" };
  if (customObjectId) {
    filter.custom_object_id = customObjectId;
  } else if (entityType) {
    filter.entity_type = entityType;
    filter["custom_object_id@is"] = "null";
  }

  const { data: fields, isLoading } = useGetList<CustomFieldDefinition>(
    "custom_field_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sort_order", order: "ASC" },
      filter,
    }
  );

  const [create] = useCreate();
  const [update] = useUpdate();

  // Technischen Namen aus Label generieren
  const generateName = (label: string) => {
    return label
      .toLowerCase()
      .replace(/[äöüß]/g, (c) =>
        ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c] || c)
      )
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  };

  const handleLabelChange = (label: string) => {
    setFormData((prev) => ({
      ...prev,
      label,
      name: prev.name || generateName(label),
    }));
  };

  const resetForm = () => {
    setFormData(DEFAULT_FORM_DATA);
    setNewOption("");
  };

  const handleAddOption = () => {
    if (!newOption.trim()) return;
    const option: SelectOption = {
      value: generateName(newOption),
      label: newOption.trim(),
    };
    setFormData((prev) => ({
      ...prev,
      options: [...(prev.options || []), option],
    }));
    setNewOption("");
  };

  const handleRemoveOption = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options?.filter((_, i) => i !== index),
    }));
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.label.trim()) {
      notify(translate("crm.custom_fields.fill_required"), { type: "error" });
      return;
    }

    const data: Record<string, unknown> = {
      ...formData,
      custom_object_id: customObjectId || null,
      entity_type: entityType || null,
      sort_order: (fields?.length || 0) + 1,
    };

    // Leere Felder bereinigen
    if (!data.options?.length) data.options = null;
    if (!data.reference_object) data.reference_object = null;
    if (!data.reference_display_field) data.reference_display_field = null;
    if (!data.default_value) data.default_value = null;
    if (!data.placeholder) data.placeholder = null;
    if (!data.help_text) data.help_text = null;
    if (!data.field_group) data.field_group = null;
    if (!data.description) data.description = null;

    try {
      await create("custom_field_definitions", { data }, { returnPromise: true });
      notify(translate("crm.custom_fields.created"), { type: "success" });
      setIsCreateDialogOpen(false);
      resetForm();
      refresh();
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : translate("crm.custom_fields.error_create"), { type: "error" });
    }
  };

  const handleUpdate = async () => {
    if (!editingField || !formData.name.trim() || !formData.label.trim()) {
      notify(translate("crm.custom_fields.fill_required"), { type: "error" });
      return;
    }

    const data: Record<string, unknown> = { ...formData };

    // Leere Felder bereinigen
    if (!data.options?.length) data.options = null;
    if (!data.reference_object) data.reference_object = null;
    if (!data.reference_display_field) data.reference_display_field = null;
    if (!data.default_value) data.default_value = null;
    if (!data.placeholder) data.placeholder = null;
    if (!data.help_text) data.help_text = null;
    if (!data.field_group) data.field_group = null;
    if (!data.description) data.description = null;

    try {
      await update("custom_field_definitions", {
        id: editingField.id,
        data,
        previousData: editingField,
      }, { returnPromise: true });
      notify(translate("crm.custom_fields.updated"), { type: "success" });
      setEditingField(null);
      resetForm();
      refresh();
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : translate("crm.custom_fields.error_update"), { type: "error" });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmField) return;

    try {
      // Soft Delete
      await update("custom_field_definitions", {
        id: deleteConfirmField.id,
        data: { deleted_at: new Date().toISOString() },
        previousData: deleteConfirmField,
      }, { returnPromise: true });
      notify(translate("crm.custom_fields.deleted"), { type: "success" });
      setDeleteConfirmField(null);
      refresh();
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : translate("crm.custom_fields.error_delete"), { type: "error" });
    }
  };

  const openEditDialog = (field: CustomFieldDefinition) => {
    setFormData({
      name: field.name,
      label: field.label,
      description: field.description || "",
      field_type: field.field_type,
      is_required: field.is_required,
      is_unique: field.is_unique,
      default_value: field.default_value || "",
      options: field.options || [],
      reference_object: field.reference_object || "",
      reference_display_field: field.reference_display_field || "",
      placeholder: field.placeholder || "",
      help_text: field.help_text || "",
      show_in_list: field.show_in_list,
      show_in_detail: field.show_in_detail,
      column_width: field.column_width || 150,
      field_group: field.field_group || "",
    });
    setEditingField(field);
  };

  const title = customObjectName
    ? translate("crm.custom_fields.fields_for", { name: customObjectName })
    : entityType
    ? translate("crm.custom_fields.title")
    : translate("crm.custom_fields.fields");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base flex items-center gap-2">
            <Type className="w-4 h-4" />
            {title}
          </CardTitle>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setIsCreateDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            {translate("crm.custom_fields.add_field")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[450px] pr-2">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {translate("crm.custom_fields.loading")}
            </div>
          ) : fields?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Type className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{translate("crm.custom_fields.no_fields")}</p>
              <p className="text-sm mt-2">
                {translate("crm.custom_fields.add_custom_fields")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {fields?.map((field) => {
                const Icon = FIELD_TYPE_ICONS[field.field_type] || Type;
                return (
                  <div
                    key={field.id}
                    className="group flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <GripVertical className="w-4 h-4 opacity-30 cursor-grab" />

                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {field.label}
                        </span>
                        {field.is_required && (
                          <Badge variant="destructive" className="text-xs">
                            {translate("crm.custom_fields.required")}
                          </Badge>
                        )}
                        {field.is_unique && (
                          <Badge variant="outline" className="text-xs">
                            {translate("crm.custom_fields.unique")}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{field.name}</span>
                        <span>•</span>
                        <span>{FIELD_TYPE_LABELS[field.field_type]}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={() => openEditDialog(field)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600"
                        onClick={() => setDeleteConfirmField(field)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      {/* Dialog: Feld erstellen/bearbeiten */}
      <Dialog
        open={isCreateDialogOpen || !!editingField}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingField(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingField ? translate("crm.custom_fields.edit_dialog_title") : translate("crm.custom_fields.create_dialog_title")}
            </DialogTitle>
            <DialogDescription>
              {editingField
                ? translate("crm.custom_fields.edit_dialog_desc")
                : translate("crm.custom_fields.create_dialog_desc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Feldtyp */}
            <div className="space-y-2">
              <Label>{translate("crm.custom_fields.field_type")} *</Label>
              <Select
                value={formData.field_type}
                onValueChange={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    field_type: v as CustomFieldType,
                  }))
                }
                disabled={!!editingField}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FIELD_TYPE_LABELS) as CustomFieldType[]).map(
                    (type) => {
                      const Icon = FIELD_TYPE_ICONS[type];
                      return (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {FIELD_TYPE_LABELS[type]}
                          </div>
                        </SelectItem>
                      );
                    }
                  )}
                </SelectContent>
              </Select>
              {editingField && (
                <p className="text-xs text-muted-foreground">
                  {translate("crm.custom_fields.field_type_locked")}
                </p>
              )}
            </div>

            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="field-label">{translate("crm.custom_fields.display_name")} *</Label>
              <Input
                id="field-label"
                value={formData.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="z.B. Projektnummer"
              />
            </div>

            {/* Name (technisch) */}
            <div className="space-y-2">
              <Label htmlFor="field-name">{translate("crm.custom_fields.technical_name")} *</Label>
              <Input
                id="field-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="z.B. project_number"
                className="font-mono text-sm"
                disabled={!!editingField}
              />
            </div>

            {/* Beschreibung */}
            <div className="space-y-2">
              <Label htmlFor="field-description">{translate("crm.custom_fields.description")}</Label>
              <Textarea
                id="field-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder={translate("crm.custom_fields.description_placeholder")}
                rows={2}
              />
            </div>

            {/* Optionen für Select/Multiselect */}
            {(formData.field_type === "select" ||
              formData.field_type === "multiselect") && (
              <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                <Label className="text-sm font-semibold">
                  {translate("crm.custom_fields.select_options")} *
                </Label>
                <p className="text-xs text-muted-foreground">
                  {formData.field_type === "multiselect"
                    ? "Geben Sie die Optionen ein, aus denen Benutzer mehrere auswählen können."
                    : "Geben Sie die Optionen ein, aus denen Benutzer eine auswählen können."}
                </p>
                <div className="flex gap-2">
                  <Input
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder={translate("crm.custom_fields.new_option", { _: "Neue Option eingeben…" })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddOption();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddOption}
                    disabled={!newOption.trim()}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Hinzufügen
                  </Button>
                </div>
                {formData.options && formData.options.length > 0 ? (
                  <div className="space-y-1">
                    {formData.options.map((opt, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-2 py-1.5 rounded border bg-background text-sm"
                      >
                        <span>{opt.label}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveOption(idx)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Noch keine Optionen hinzugefügt. Geben Sie mindestens eine Option ein.
                  </p>
                )}
              </div>
            )}

            {/* Referenz für Reference-Felder */}
            {formData.field_type === "reference" && (
              <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                <Label className="text-sm font-semibold">
                  Verknüpfung konfigurieren
                </Label>
                <p className="text-xs text-muted-foreground">
                  Wählen Sie das Ziel-Objekt, mit dem verknüpft werden soll.
                  Im Formular erscheint automatisch eine Dropdown-Liste aller sichtbaren Einträge.
                </p>
                <div className="space-y-2">
                  <Label>{translate("crm.custom_fields.reference_object")}</Label>
                  <Select
                    value={formData.reference_object || undefined}
                    onValueChange={(v) =>
                      setFormData((prev) => ({ ...prev, reference_object: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={translate("crm.custom_fields.select_object", { _: "Objekt auswählen…" })} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contacts">{translate("crm.custom_fields.ref_contacts", { _: "Kontakte" })}</SelectItem>
                      <SelectItem value="companies">{translate("crm.custom_fields.ref_companies", { _: "Unternehmen" })}</SelectItem>
                      <SelectItem value="deals">{translate("crm.custom_fields.ref_deals", { _: "Deals" })}</SelectItem>
                      <SelectItem value="sales">Mitarbeiter</SelectItem>
                      {allCustomObjects && allCustomObjects.length > 0 && (
                        <>
                          <div className="border-t my-1" />
                          <div className="px-2 py-1 text-xs text-muted-foreground font-medium">Custom Objects</div>
                          {allCustomObjects.map((obj) => (
                            <SelectItem key={obj.id} value={`custom_${obj.name}`}>
                              {obj.label}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{translate("crm.custom_fields.display_field", { _: "Anzeigefeld" })}</Label>
                  <Input
                    value={formData.reference_display_field}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        reference_display_field: e.target.value,
                      }))
                    }
                    placeholder="z.B. name, title, label"
                  />
                  <p className="text-xs text-muted-foreground">
                    Der Feldname, der im Dropdown als Anzeige verwendet wird (Standard: name).
                  </p>
                </div>
                {formData.reference_object && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Link className="w-3.5 h-3.5" />
                    Verknüpft mit: <strong>{formData.reference_object.startsWith("custom_") ? allCustomObjects?.find(o => `custom_${o.name}` === formData.reference_object)?.label || formData.reference_object : formData.reference_object}</strong>
                    — Einträge werden automatisch als Dropdown im Formular und QuickView angezeigt.
                  </div>
                )}
              </div>
            )}

            {/* Platzhalter & Hilfetext */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="placeholder">{translate("crm.custom_fields.placeholder")}</Label>
                <Input
                  id="placeholder"
                  value={formData.placeholder}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      placeholder: e.target.value,
                    }))
                  }
                  placeholder="z.B. Geben Sie..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="help_text">{translate("crm.custom_fields.help_text")}</Label>
                <Input
                  id="help_text"
                  value={formData.help_text}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      help_text: e.target.value,
                    }))
                  }
                  placeholder="Zusätzliche Info..."
                />
              </div>
            </div>

            {/* Standardwert */}
            <div className="space-y-2">
              <Label htmlFor="default_value">{translate("crm.custom_fields.default_value")}</Label>
              <Input
                id="default_value"
                value={formData.default_value}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    default_value: e.target.value,
                  }))
                }
                placeholder={translate("crm.custom_fields.default_value_placeholder")}
              />
            </div>

            {/* Feldgruppe */}
            <div className="space-y-2">
              <Label htmlFor="field_group">{translate("crm.custom_fields.field_group")}</Label>
              <Input
                id="field_group"
                value={formData.field_group}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    field_group: e.target.value,
                  }))
                }
                placeholder="z.B. Allgemein, Details..."
              />
            </div>

            {/* Optionen */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-sm font-medium">{translate("crm.custom_objects.options")}</Label>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm">{translate("crm.custom_fields.option_required")}</div>
                  <Switch
                    checked={formData.is_required}
                    onCheckedChange={(v) =>
                      setFormData((prev) => ({ ...prev, is_required: v }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm">{translate("crm.custom_fields.option_unique")}</div>
                  <Switch
                    checked={formData.is_unique}
                    onCheckedChange={(v) =>
                      setFormData((prev) => ({ ...prev, is_unique: v }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm">{translate("crm.custom_fields.option_show_in_list")}</div>
                  <Switch
                    checked={formData.show_in_list}
                    onCheckedChange={(v) =>
                      setFormData((prev) => ({ ...prev, show_in_list: v }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm">{translate("crm.custom_fields.option_show_in_detail")}</div>
                  <Switch
                    checked={formData.show_in_detail}
                    onCheckedChange={(v) =>
                      setFormData((prev) => ({ ...prev, show_in_detail: v }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setEditingField(null);
                resetForm();
              }}
            >
              <X className="w-4 h-4 mr-2" />
              {translate("crm.cancel")}
            </Button>
            <Button onClick={editingField ? handleUpdate : handleCreate}>
              <Save className="w-4 h-4 mr-2" />
              {editingField ? translate("crm.save") : translate("crm.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Feld löschen */}
      <AlertDialog
        open={!!deleteConfirmField}
        onOpenChange={(open) => !open && setDeleteConfirmField(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{translate("crm.custom_fields.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {translate("crm.custom_fields.delete_desc", { label: deleteConfirmField?.label })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{translate("crm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {translate("crm.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default CustomFieldsManager;
