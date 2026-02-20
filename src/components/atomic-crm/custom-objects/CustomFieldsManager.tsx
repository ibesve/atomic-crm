import { useState } from "react";
import {
  useGetList,
  useCreate,
  useUpdate,
  useNotify,
  useRefresh,
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

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingField, setEditingField] =
    useState<CustomFieldDefinition | null>(null);
  const [deleteConfirmField, setDeleteConfirmField] =
    useState<CustomFieldDefinition | null>(null);
  const [formData, setFormData] =
    useState<CustomFieldFormData>(DEFAULT_FORM_DATA);
  const [newOption, setNewOption] = useState("");

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
      notify("Bitte füllen Sie alle Pflichtfelder aus", { type: "error" });
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
      await create("custom_field_definitions", { data });
      notify("Feld erstellt", { type: "success" });
      setIsCreateDialogOpen(false);
      resetForm();
      refresh();
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Fehler beim Erstellen", { type: "error" });
    }
  };

  const handleUpdate = async () => {
    if (!editingField || !formData.name.trim() || !formData.label.trim()) {
      notify("Bitte füllen Sie alle Pflichtfelder aus", { type: "error" });
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
      });
      notify("Feld aktualisiert", { type: "success" });
      setEditingField(null);
      resetForm();
      refresh();
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Fehler beim Aktualisieren", { type: "error" });
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
      });
      notify("Feld gelöscht", { type: "success" });
      setDeleteConfirmField(null);
      refresh();
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Fehler beim Löschen", { type: "error" });
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
    ? `Felder für "${customObjectName}"`
    : entityType
    ? `Custom Fields`
    : "Felder";

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
            Feld hinzufügen
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[450px] pr-2">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Lade...
            </div>
          ) : fields?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Type className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Keine Felder vorhanden</p>
              <p className="text-sm mt-2">
                Fügen Sie benutzerdefinierte Felder hinzu
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
                            Pflicht
                          </Badge>
                        )}
                        {field.is_unique && (
                          <Badge variant="outline" className="text-xs">
                            Eindeutig
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
              {editingField ? "Feld bearbeiten" : "Neues Feld erstellen"}
            </DialogTitle>
            <DialogDescription>
              {editingField
                ? "Ändern Sie die Eigenschaften des Felds."
                : "Definieren Sie ein neues benutzerdefiniertes Feld."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Feldtyp */}
            <div className="space-y-2">
              <Label>Feldtyp *</Label>
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
                  Der Feldtyp kann nicht mehr geändert werden
                </p>
              )}
            </div>

            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="field-label">Anzeigename *</Label>
              <Input
                id="field-label"
                value={formData.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="z.B. Projektnummer"
              />
            </div>

            {/* Name (technisch) */}
            <div className="space-y-2">
              <Label htmlFor="field-name">Technischer Name *</Label>
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
              <Label htmlFor="field-description">Beschreibung</Label>
              <Textarea
                id="field-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Optionale Beschreibung..."
                rows={2}
              />
            </div>

            {/* Optionen für Select/Multiselect */}
            {(formData.field_type === "select" ||
              formData.field_type === "multiselect") && (
              <div className="space-y-2">
                <Label>Auswahloptionen</Label>
                <div className="flex gap-2">
                  <Input
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder="Neue Option..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddOption();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddOption}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {formData.options && formData.options.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.options.map((opt, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleRemoveOption(idx)}
                      >
                        {opt.label}
                        <X className="w-3 h-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Referenz für Reference-Felder */}
            {formData.field_type === "reference" && (
              <>
                <div className="space-y-2">
                  <Label>Referenz-Objekt</Label>
                  <Select
                    value={formData.reference_object}
                    onValueChange={(v) =>
                      setFormData((prev) => ({ ...prev, reference_object: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Objekt auswählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contacts">Kontakte</SelectItem>
                      <SelectItem value="companies">Unternehmen</SelectItem>
                      <SelectItem value="deals">Deals</SelectItem>
                      {/* Hier könnten dynamisch Custom Objects geladen werden */}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Anzeigefeld</Label>
                  <Input
                    value={formData.reference_display_field}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        reference_display_field: e.target.value,
                      }))
                    }
                    placeholder="z.B. name"
                  />
                </div>
              </>
            )}

            {/* Platzhalter & Hilfetext */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="placeholder">Platzhalter</Label>
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
                <Label htmlFor="help_text">Hilfetext</Label>
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
              <Label htmlFor="default_value">Standardwert</Label>
              <Input
                id="default_value"
                value={formData.default_value}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    default_value: e.target.value,
                  }))
                }
                placeholder="Optionaler Standardwert"
              />
            </div>

            {/* Feldgruppe */}
            <div className="space-y-2">
              <Label htmlFor="field_group">Feldgruppe</Label>
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
              <Label className="text-sm font-medium">Optionen</Label>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm">Pflichtfeld</div>
                  <Switch
                    checked={formData.is_required}
                    onCheckedChange={(v) =>
                      setFormData((prev) => ({ ...prev, is_required: v }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm">Eindeutig</div>
                  <Switch
                    checked={formData.is_unique}
                    onCheckedChange={(v) =>
                      setFormData((prev) => ({ ...prev, is_unique: v }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm">In Liste zeigen</div>
                  <Switch
                    checked={formData.show_in_list}
                    onCheckedChange={(v) =>
                      setFormData((prev) => ({ ...prev, show_in_list: v }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm">In Details zeigen</div>
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
              Abbrechen
            </Button>
            <Button onClick={editingField ? handleUpdate : handleCreate}>
              <Save className="w-4 h-4 mr-2" />
              {editingField ? "Speichern" : "Erstellen"}
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
            <AlertDialogTitle>Feld löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie das Feld "{deleteConfirmField?.label}" wirklich
              löschen? Alle gespeicherten Werte für dieses Feld werden
              ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht
              werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default CustomFieldsManager;
