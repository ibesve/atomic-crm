import { useState } from "react";
import {
  useGetList,
  useCreate,
  useUpdate,
  useDelete,
  useNotify,
  useRefresh,
} from "ra-core";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Pencil,
  Trash2,
  Tags,
  Shield,
  User,
  X,
} from "lucide-react";
import type {
  AttributeDefinition,
  AttributeDataType,
  AttributeAppliesTo,
  AttributeAllowedValue,
} from "../types/rbac";
import { ATTRIBUTE_DATA_TYPES } from "../types/rbac";

interface AttributeDefinitionsManagerProps {
  className?: string;
}

export function AttributeDefinitionsManager({
  className,
}: AttributeDefinitionsManagerProps) {
  const notify = useNotify();
  const refresh = useRefresh();
  const [create] = useCreate();
  const [update] = useUpdate();
  const [deleteOne] = useDelete();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<AttributeDefinition | null>(null);
  const [attributeToDelete, setAttributeToDelete] = useState<AttributeDefinition | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    label: "",
    description: "",
    data_type: "text" as AttributeDataType,
    allowed_values: [] as AttributeAllowedValue[],
    applies_to: ["user"] as AttributeAppliesTo[],
  });

  const [newAllowedValue, setNewAllowedValue] = useState({ value: "", label: "" });

  const { data: attributes, isLoading } = useGetList<AttributeDefinition>(
    "attribute_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "name", order: "ASC" },
    }
  );

  const resetForm = () => {
    setFormData({
      name: "",
      label: "",
      description: "",
      data_type: "text",
      allowed_values: [],
      applies_to: ["user"],
    });
    setNewAllowedValue({ value: "", label: "" });
    setEditingAttribute(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (attribute: AttributeDefinition) => {
    setEditingAttribute(attribute);
    setFormData({
      name: attribute.name,
      label: attribute.label,
      description: attribute.description || "",
      data_type: attribute.data_type,
      allowed_values: attribute.allowed_values || [],
      applies_to: attribute.applies_to,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.label) {
      notify("Name und Label sind erforderlich", { type: "error" });
      return;
    }

    try {
      const data = {
        ...formData,
        allowed_values: formData.data_type === "select" ? formData.allowed_values : null,
      };

      if (editingAttribute) {
        await update(
          "attribute_definitions",
          {
            id: editingAttribute.id,
            data,
            previousData: editingAttribute,
          },
          {
            onSuccess: () => {
              notify("Attribut aktualisiert", { type: "success" });
              setIsDialogOpen(false);
              resetForm();
              refresh();
            },
          }
        );
      } else {
        await create(
          "attribute_definitions",
          { data },
          {
            onSuccess: () => {
              notify("Attribut erstellt", { type: "success" });
              setIsDialogOpen(false);
              resetForm();
              refresh();
            },
          }
        );
      }
    } catch (error: any) {
      notify(error.message || "Fehler beim Speichern", { type: "error" });
    }
  };

  const handleDelete = async () => {
    if (!attributeToDelete) return;

    try {
      await deleteOne(
        "attribute_definitions",
        { id: attributeToDelete.id, previousData: attributeToDelete },
        {
          onSuccess: () => {
            notify("Attribut gelöscht", { type: "success" });
            setIsDeleteDialogOpen(false);
            setAttributeToDelete(null);
            refresh();
          },
        }
      );
    } catch (error: any) {
      notify(error.message || "Fehler beim Löschen", { type: "error" });
    }
  };

  const addAllowedValue = () => {
    if (!newAllowedValue.value || !newAllowedValue.label) return;
    setFormData({
      ...formData,
      allowed_values: [...formData.allowed_values, { ...newAllowedValue }],
    });
    setNewAllowedValue({ value: "", label: "" });
  };

  const removeAllowedValue = (index: number) => {
    setFormData({
      ...formData,
      allowed_values: formData.allowed_values.filter((_, i) => i !== index),
    });
  };

  const toggleAppliesTo = (target: AttributeAppliesTo) => {
    const newAppliesTo = formData.applies_to.includes(target)
      ? formData.applies_to.filter((t) => t !== target)
      : [...formData.applies_to, target];
    
    if (newAppliesTo.length === 0) return; // Mindestens eines muss ausgewählt sein
    
    setFormData({ ...formData, applies_to: newAppliesTo });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5" />
              Attribut-Definitionen
            </CardTitle>
            <CardDescription>
              Definieren Sie Attribute für Benutzer und Rollen (z.B. Region, Abteilung)
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Neues Attribut
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Laden...</div>
        ) : !attributes?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            Keine Attribute definiert
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Datentyp</TableHead>
                <TableHead>Anwendbar auf</TableHead>
                <TableHead>System</TableHead>
                <TableHead className="w-[100px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attributes.map((attr) => (
                <TableRow key={attr.id}>
                  <TableCell className="font-mono text-sm">{attr.name}</TableCell>
                  <TableCell>{attr.label}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {ATTRIBUTE_DATA_TYPES[attr.data_type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {attr.applies_to.includes("user") && (
                        <Badge variant="secondary" className="gap-1">
                          <User className="h-3 w-3" />
                          Benutzer
                        </Badge>
                      )}
                      {attr.applies_to.includes("role") && (
                        <Badge variant="secondary" className="gap-1">
                          <Shield className="h-3 w-3" />
                          Rolle
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {attr.is_system ? (
                      <Badge variant="default">System</Badge>
                    ) : (
                      <Badge variant="outline">Benutzerdefiniert</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(attr)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!attr.is_system && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setAttributeToDelete(attr);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingAttribute ? "Attribut bearbeiten" : "Neues Attribut"}
              </DialogTitle>
              <DialogDescription>
                Definieren Sie ein Attribut für die attributbasierte Zugriffskontrolle
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Technischer Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s/g, "_") })
                    }
                    placeholder="z.B. region"
                    disabled={editingAttribute?.is_system}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="label">Anzeigename</Label>
                  <Input
                    id="label"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="z.B. Region"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optionale Beschreibung"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Datentyp</Label>
                <Select
                  value={formData.data_type}
                  onValueChange={(value: AttributeDataType) =>
                    setFormData({ ...formData, data_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ATTRIBUTE_DATA_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Anwendbar auf</Label>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.applies_to.includes("user")}
                      onCheckedChange={() => toggleAppliesTo("user")}
                    />
                    <Label className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      Benutzer
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.applies_to.includes("role")}
                      onCheckedChange={() => toggleAppliesTo("role")}
                    />
                    <Label className="flex items-center gap-1">
                      <Shield className="h-4 w-4" />
                      Rollen
                    </Label>
                  </div>
                </div>
              </div>

              {formData.data_type === "select" && (
                <div className="space-y-2">
                  <Label>Erlaubte Werte</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Wert"
                      value={newAllowedValue.value}
                      onChange={(e) =>
                        setNewAllowedValue({ ...newAllowedValue, value: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Label"
                      value={newAllowedValue.label}
                      onChange={(e) =>
                        setNewAllowedValue({ ...newAllowedValue, label: e.target.value })
                      }
                    />
                    <Button type="button" variant="outline" onClick={addAllowedValue}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.allowed_values.map((val, index) => (
                      <Badge key={index} variant="secondary" className="gap-1">
                        {val.label} ({val.value})
                        <button
                          type="button"
                          onClick={() => removeAllowedValue(index)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSubmit}>
                {editingAttribute ? "Speichern" : "Erstellen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Attribut löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Möchten Sie das Attribut "{attributeToDelete?.label}" wirklich löschen?
                Alle zugewiesenen Werte werden ebenfalls entfernt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Löschen</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

export default AttributeDefinitionsManager;
