import { useState } from "react";
import {
  useGetList,
  useCreate,
  useUpdate,
  useDelete,
  useNotify,
  useRefresh,
  useTranslate,
} from "ra-core";
import {
  Box,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ChevronRight,
  Settings2,
  Save,
  X,
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
import { cn } from "@/lib/utils";
import type {
  CustomObjectDefinition,
  CustomObjectFormData,
} from "../types/custom-objects";
import { CUSTOM_OBJECT_ICONS } from "../types/custom-objects";
import { CustomFieldsManager } from "./CustomFieldsManager";

const COLORS = [
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#14b8a6", // Teal
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
];

const DEFAULT_FORM_DATA: CustomObjectFormData = {
  name: "",
  label: "",
  label_plural: "",
  description: "",
  icon: "box",
  color: "#6366f1",
  is_active: true,
  allow_attachments: true,
  allow_notes: true,
  allow_tasks: false,
};

export function CustomObjectsManager() {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();

  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingObject, setEditingObject] =
    useState<CustomObjectDefinition | null>(null);
  const [deleteConfirmObject, setDeleteConfirmObject] =
    useState<CustomObjectDefinition | null>(null);
  const [formData, setFormData] =
    useState<CustomObjectFormData>(DEFAULT_FORM_DATA);

  const { data: objects, isLoading } = useGetList<CustomObjectDefinition>(
    "custom_object_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sort_order", order: "ASC" },
      filter: { deleted_at: null },
    }
  );

  const [create] = useCreate();
  const [update] = useUpdate();
  const [deleteOne] = useDelete();

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

  // Plural aus Label generieren
  const generatePlural = (label: string) => {
    if (label.endsWith("e")) return label + "n";
    if (label.endsWith("er") || label.endsWith("en")) return label;
    return label + "e";
  };

  const handleLabelChange = (label: string) => {
    setFormData((prev) => ({
      ...prev,
      label,
      name: prev.name || generateName(label),
      label_plural: prev.label_plural || generatePlural(label),
    }));
  };

  const resetForm = () => {
    setFormData(DEFAULT_FORM_DATA);
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.label.trim()) {
      notify("Bitte füllen Sie alle Pflichtfelder aus", { type: "error" });
      return;
    }

    try {
      await create("custom_object_definitions", { data: formData });
      notify("Objekt erstellt", { type: "success" });
      setIsCreateDialogOpen(false);
      resetForm();
      refresh();
    } catch (error: any) {
      notify(error.message || "Fehler beim Erstellen", { type: "error" });
    }
  };

  const handleUpdate = async () => {
    if (!editingObject || !formData.name.trim() || !formData.label.trim()) {
      notify("Bitte füllen Sie alle Pflichtfelder aus", { type: "error" });
      return;
    }

    try {
      await update("custom_object_definitions", {
        id: editingObject.id,
        data: formData,
        previousData: editingObject,
      });
      notify("Objekt aktualisiert", { type: "success" });
      setEditingObject(null);
      resetForm();
      refresh();
    } catch (error: any) {
      notify(error.message || "Fehler beim Aktualisieren", { type: "error" });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmObject) return;

    try {
      await deleteOne("custom_object_definitions", {
        id: deleteConfirmObject.id,
        previousData: deleteConfirmObject,
      });
      notify("Objekt gelöscht", { type: "success" });
      if (selectedObjectId === deleteConfirmObject.id) {
        setSelectedObjectId(null);
      }
      setDeleteConfirmObject(null);
      refresh();
    } catch (error: any) {
      notify(error.message || "Fehler beim Löschen", { type: "error" });
    }
  };

  const openEditDialog = (obj: CustomObjectDefinition, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData({
      name: obj.name,
      label: obj.label,
      label_plural: obj.label_plural,
      description: obj.description || "",
      icon: obj.icon,
      color: obj.color,
      is_active: obj.is_active,
      allow_attachments: obj.allow_attachments,
      allow_notes: obj.allow_notes,
      allow_tasks: obj.allow_tasks,
    });
    setEditingObject(obj);
  };

  const openDeleteDialog = (
    obj: CustomObjectDefinition,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setDeleteConfirmObject(obj);
  };

  const selectedObject = objects?.find((o) => o.id === selectedObjectId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Objektliste */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base flex items-center gap-2">
              <Box className="w-4 h-4" />
              {translate("crm.custom_objects.title", {
                _: "Benutzerdefinierte Objekte",
              })}
            </CardTitle>
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setIsCreateDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              Neu
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-2">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Lade...
              </div>
            ) : objects?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Box className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Keine Objekte vorhanden</p>
                <p className="text-sm mt-2">
                  Erstellen Sie Ihr erstes benutzerdefiniertes Objekt
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {objects?.map((obj) => (
                  <div
                    key={obj.id}
                    onClick={() => setSelectedObjectId(obj.id)}
                    className={cn(
                      "group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                      selectedObjectId === obj.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <GripVertical className="w-4 h-4 opacity-30 cursor-grab" />

                    <div
                      className="w-8 h-8 rounded flex items-center justify-center"
                      style={{ backgroundColor: obj.color + "20" }}
                    >
                      <Box
                        className="w-4 h-4"
                        style={{ color: obj.color }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {obj.label}
                        </span>
                        {!obj.is_active && (
                          <Badge variant="secondary" className="text-xs">
                            Inaktiv
                          </Badge>
                        )}
                      </div>
                      <div
                        className={cn(
                          "text-xs truncate",
                          selectedObjectId === obj.id
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        )}
                      >
                        {obj.name}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7 opacity-0 group-hover:opacity-100",
                          selectedObjectId === obj.id &&
                            "hover:bg-primary-foreground/20"
                        )}
                        onClick={(e) => openEditDialog(obj, e)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7 opacity-0 group-hover:opacity-100",
                          selectedObjectId === obj.id
                            ? "hover:bg-primary-foreground/20 text-red-200"
                            : "text-red-500 hover:text-red-600"
                        )}
                        onClick={(e) => openDeleteDialog(obj, e)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Feld-Editor */}
      <div className="lg:col-span-2">
        {selectedObject ? (
          <CustomFieldsManager
            customObjectId={selectedObject.id}
            customObjectName={selectedObject.label}
          />
        ) : (
          <Card className="h-full flex items-center justify-center min-h-[400px]">
            <div className="text-center p-8">
              <Settings2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Wählen Sie ein Objekt aus, um dessen Felder zu bearbeiten
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Dialog: Objekt erstellen/bearbeiten */}
      <Dialog
        open={isCreateDialogOpen || !!editingObject}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingObject(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingObject
                ? "Objekt bearbeiten"
                : "Neues Objekt erstellen"}
            </DialogTitle>
            <DialogDescription>
              {editingObject
                ? "Ändern Sie die Eigenschaften des Objekts."
                : "Definieren Sie ein neues benutzerdefiniertes Objekt."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="label">Anzeigename *</Label>
              <Input
                id="label"
                value={formData.label}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="z.B. Projekt"
              />
            </div>

            {/* Name (technisch) */}
            <div className="space-y-2">
              <Label htmlFor="name">Technischer Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="z.B. project"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Nur Kleinbuchstaben, Zahlen und Unterstriche
              </p>
            </div>

            {/* Plural */}
            <div className="space-y-2">
              <Label htmlFor="label_plural">Plural *</Label>
              <Input
                id="label_plural"
                value={formData.label_plural}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    label_plural: e.target.value,
                  }))
                }
                placeholder="z.B. Projekte"
              />
            </div>

            {/* Beschreibung */}
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
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

            {/* Icon & Farbe */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, icon: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOM_OBJECT_ICONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        <span className="capitalize">{icon}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Farbe</Label>
                <div className="flex flex-wrap gap-1">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        "w-6 h-6 rounded-full transition-transform",
                        formData.color === color &&
                          "ring-2 ring-offset-2 ring-primary scale-110"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, color }))
                      }
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Optionen */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-sm font-medium">Optionen</Label>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm">Aktiv</div>
                  <div className="text-xs text-muted-foreground">
                    Objekt kann verwendet werden
                  </div>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) =>
                    setFormData((prev) => ({ ...prev, is_active: v }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm">Anhänge erlauben</div>
                  <div className="text-xs text-muted-foreground">
                    Dateien können hochgeladen werden
                  </div>
                </div>
                <Switch
                  checked={formData.allow_attachments}
                  onCheckedChange={(v) =>
                    setFormData((prev) => ({ ...prev, allow_attachments: v }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm">Notizen erlauben</div>
                  <div className="text-xs text-muted-foreground">
                    Notizen können hinzugefügt werden
                  </div>
                </div>
                <Switch
                  checked={formData.allow_notes}
                  onCheckedChange={(v) =>
                    setFormData((prev) => ({ ...prev, allow_notes: v }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm">Aufgaben erlauben</div>
                  <div className="text-xs text-muted-foreground">
                    Aufgaben können zugewiesen werden
                  </div>
                </div>
                <Switch
                  checked={formData.allow_tasks}
                  onCheckedChange={(v) =>
                    setFormData((prev) => ({ ...prev, allow_tasks: v }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setEditingObject(null);
                resetForm();
              }}
            >
              <X className="w-4 h-4 mr-2" />
              Abbrechen
            </Button>
            <Button onClick={editingObject ? handleUpdate : handleCreate}>
              <Save className="w-4 h-4 mr-2" />
              {editingObject ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Objekt löschen */}
      <AlertDialog
        open={!!deleteConfirmObject}
        onOpenChange={(open) => !open && setDeleteConfirmObject(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Objekt löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie das Objekt "{deleteConfirmObject?.label}" wirklich
              löschen? Alle zugehörigen Felder und Daten werden ebenfalls
              gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
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
    </div>
  );
}

export default CustomObjectsManager;
