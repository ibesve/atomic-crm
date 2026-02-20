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
import {
  Plus,
  Pencil,
  Trash2,
  Filter,
  CheckCircle,
  XCircle,
} from "lucide-react";
import type {
  PermissionCondition,
  RolePermission,
  AttributeDefinition,
  ConditionOperator,
  ConditionSourceType,
  ConditionType,
  LogicOperator,
  ResourceType,
} from "../types/rbac";
import {
  CONDITION_OPERATORS,
  SOURCE_TYPES,
  RESOURCE_FIELDS,
} from "../types/rbac";

interface PermissionConditionsManagerProps {
  className?: string;
  rolePermissionId?: number;
  resource?: ResourceType;
}

export function PermissionConditionsManager({
  className,
  rolePermissionId,
  resource,
}: PermissionConditionsManagerProps) {
  const notify = useNotify();
  const refresh = useRefresh();
  const [create] = useCreate();
  const [update] = useUpdate();
  const [deleteOne] = useDelete();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCondition, setEditingCondition] = useState<PermissionCondition | null>(null);
  const [conditionToDelete, setConditionToDelete] = useState<PermissionCondition | null>(null);

  const [formData, setFormData] = useState({
    role_permission_id: rolePermissionId || 0,
    condition_type: "attribute_match" as ConditionType,
    target_field: "",
    operator: "=" as ConditionOperator,
    source_type: "user_attribute" as ConditionSourceType,
    source_attribute: "",
    static_values: [] as string[],
    logic_operator: "AND" as LogicOperator,
    is_active: true,
  });

  const [newStaticValue, setNewStaticValue] = useState("");

  const { data: conditions, isLoading } = useGetList<PermissionCondition>(
    "permission_conditions",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
      filter: rolePermissionId ? { role_permission_id: rolePermissionId } : {},
    }
  );

  const { data: permissions } = useGetList<RolePermission & { role_name?: string }>(
    "role_permissions",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "resource", order: "ASC" },
    }
  );

  const { data: attributeDefinitions } = useGetList<AttributeDefinition>(
    "attribute_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "name", order: "ASC" },
    }
  );

  const resetForm = () => {
    setFormData({
      role_permission_id: rolePermissionId || 0,
      condition_type: "attribute_match",
      target_field: "",
      operator: "=",
      source_type: "user_attribute",
      source_attribute: "",
      static_values: [],
      logic_operator: "AND",
      is_active: true,
    });
    setNewStaticValue("");
    setEditingCondition(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (condition: PermissionCondition) => {
    setEditingCondition(condition);
    setFormData({
      role_permission_id: condition.role_permission_id,
      condition_type: condition.condition_type,
      target_field: condition.target_field,
      operator: condition.operator,
      source_type: condition.source_type,
      source_attribute: condition.source_attribute || "",
      static_values: condition.static_values || [],
      logic_operator: condition.logic_operator,
      is_active: condition.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.role_permission_id || !formData.target_field) {
      notify("Berechtigung und Zielfeld sind erforderlich", { type: "error" });
      return;
    }

    try {
      const data = {
        ...formData,
        static_values: formData.operator === "IN" || formData.operator === "NOT IN" 
          ? formData.static_values 
          : null,
        source_attribute: formData.source_type === "static_value" 
          ? (formData.static_values[0] || formData.source_attribute)
          : formData.source_attribute,
      };

      if (editingCondition) {
        await update(
          "permission_conditions",
          {
            id: editingCondition.id,
            data,
            previousData: editingCondition,
          },
          {
            onSuccess: () => {
              notify("Bedingung aktualisiert", { type: "success" });
              setIsDialogOpen(false);
              resetForm();
              refresh();
            },
          }
        );
      } else {
        await create(
          "permission_conditions",
          { data },
          {
            onSuccess: () => {
              notify("Bedingung erstellt", { type: "success" });
              setIsDialogOpen(false);
              resetForm();
              refresh();
            },
          }
        );
      }
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Fehler beim Speichern", { type: "error" });
    }
  };

  const handleDelete = async () => {
    if (!conditionToDelete) return;

    try {
      await deleteOne(
        "permission_conditions",
        { id: conditionToDelete.id, previousData: conditionToDelete },
        {
          onSuccess: () => {
            notify("Bedingung gelöscht", { type: "success" });
            setIsDeleteDialogOpen(false);
            setConditionToDelete(null);
            refresh();
          },
        }
      );
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Fehler beim Löschen", { type: "error" });
    }
  };

  const toggleConditionActive = async (condition: PermissionCondition) => {
    try {
      await update(
        "permission_conditions",
        {
          id: condition.id,
          data: { is_active: !condition.is_active },
          previousData: condition,
        },
        {
          onSuccess: () => {
            notify(
              condition.is_active ? "Bedingung deaktiviert" : "Bedingung aktiviert",
              { type: "success" }
            );
            refresh();
          },
        }
      );
    } catch (error: any) {
      notify(error.message || "Fehler", { type: "error" });
    }
  };

  const addStaticValue = () => {
    if (!newStaticValue) return;
    setFormData({
      ...formData,
      static_values: [...formData.static_values, newStaticValue],
    });
    setNewStaticValue("");
  };

  const removeStaticValue = (index: number) => {
    setFormData({
      ...formData,
      static_values: formData.static_values.filter((_, i) => i !== index),
    });
  };

  const getPermissionLabel = (permId: number): string => {
    const perm = permissions?.find((p: RolePermission) => p.id === permId);
    return perm ? `${perm.resource}.${perm.action}` : `ID: ${permId}`;
  };

  const getResourceFields = () => {
    if (resource) {
      return RESOURCE_FIELDS[resource] || [];
    }
    const perm = permissions?.find((p: RolePermission) => p.id === formData.role_permission_id);
    if (perm) {
      return RESOURCE_FIELDS[perm.resource as ResourceType] || [];
    }
    return [];
  };

  const formatCondition = (condition: PermissionCondition): string => {
    const operatorLabel = CONDITION_OPERATORS[condition.operator];
    const sourceLabel = SOURCE_TYPES[condition.source_type];
    
    let valueDisplay = "";
    if (condition.source_type === "static_value") {
      valueDisplay = condition.source_attribute || "";
    } else if (condition.operator === "IN" || condition.operator === "NOT IN") {
      valueDisplay = `[${condition.static_values?.join(", ")}]`;
    } else if (condition.source_type === "current_user") {
      valueDisplay = "Aktueller Benutzer";
    } else {
      valueDisplay = `${sourceLabel}: ${condition.source_attribute}`;
    }

    return `${condition.target_field} ${operatorLabel} ${valueDisplay}`;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Attributbedingungen (ABAC)
            </CardTitle>
            <CardDescription>
              Definieren Sie zusätzliche Bedingungen für Berechtigungen basierend auf Attributen
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Neue Bedingung
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Laden...</div>
        ) : !conditions?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <Filter className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Keine Attributbedingungen definiert</p>
            <p className="text-sm mt-1">
              Bedingungen ermöglichen feinere Zugriffskontrollen basierend auf Benutzer- oder Rollenattributen
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Berechtigung</TableHead>
                <TableHead>Bedingung</TableHead>
                <TableHead>Logik</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conditions.map((condition: PermissionCondition) => (
                <TableRow key={condition.id}>
                  <TableCell>
                    <Badge variant="outline">
                      {getPermissionLabel(condition.role_permission_id)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {formatCondition(condition)}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={condition.logic_operator === "AND" ? "default" : "secondary"}>
                      {condition.logic_operator}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {condition.is_active ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Aktiv
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Inaktiv
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleConditionActive(condition)}
                        title={condition.is_active ? "Deaktivieren" : "Aktivieren"}
                      >
                        {condition.is_active ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(condition)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setConditionToDelete(condition);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                {editingCondition ? "Bedingung bearbeiten" : "Neue Bedingung"}
              </DialogTitle>
              <DialogDescription>
                Definieren Sie eine attributbasierte Zugriffsbedingung
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {!rolePermissionId && (
                <div className="space-y-2">
                  <Label>Berechtigung</Label>
                  <Select
                    value={formData.role_permission_id?.toString() || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, role_permission_id: Number(value), target_field: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Berechtigung auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {permissions?.map((perm: RolePermission) => (
                        <SelectItem key={perm.id} value={perm.id.toString()}>
                          {perm.resource}.{perm.action} ({perm.scope})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Zielfeld (im Datensatz)</Label>
                  <Select
                    value={formData.target_field}
                    onValueChange={(value) =>
                      setFormData({ ...formData, target_field: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Feld auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {getResourceFields().map((field) => (
                        <SelectItem key={field.field} value={field.field}>
                          {field.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="_custom">Eigenes Feld...</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.target_field === "_custom" && (
                    <Input
                      placeholder="Feldname eingeben"
                      onChange={(e) =>
                        setFormData({ ...formData, target_field: e.target.value })
                      }
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Operator</Label>
                  <Select
                    value={formData.operator}
                    onValueChange={(value: ConditionOperator) =>
                      setFormData({ ...formData, operator: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONDITION_OPERATORS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Vergleichswert aus</Label>
                <Select
                  value={formData.source_type}
                  onValueChange={(value: ConditionSourceType) =>
                    setFormData({ ...formData, source_type: value, source_attribute: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOURCE_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(formData.source_type === "user_attribute" ||
                formData.source_type === "role_attribute") && (
                <div className="space-y-2">
                  <Label>Attribut</Label>
                  <Select
                    value={formData.source_attribute}
                    onValueChange={(value) =>
                      setFormData({ ...formData, source_attribute: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Attribut auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {attributeDefinitions
                        ?.filter((d: AttributeDefinition) =>
                          formData.source_type === "user_attribute"
                            ? d.applies_to.includes("user")
                            : d.applies_to.includes("role")
                        )
                        .map((def: AttributeDefinition) => (
                          <SelectItem key={def.id} value={def.name}>
                            {def.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.source_type === "static_value" && (
                <div className="space-y-2">
                  <Label>Fester Wert</Label>
                  {formData.operator === "IN" || formData.operator === "NOT IN" ? (
                    <>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Wert hinzufügen"
                          value={newStaticValue}
                          onChange={(e) => setNewStaticValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStaticValue())}
                        />
                        <Button type="button" variant="outline" onClick={addStaticValue}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.static_values.map((val, index) => (
                          <Badge key={index} variant="secondary" className="gap-1">
                            {val}
                            <button
                              type="button"
                              onClick={() => removeStaticValue(index)}
                              className="ml-1 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </>
                  ) : (
                    <Input
                      value={formData.source_attribute}
                      onChange={(e) =>
                        setFormData({ ...formData, source_attribute: e.target.value })
                      }
                      placeholder="Wert eingeben"
                    />
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Logik-Operator</Label>
                  <Select
                    value={formData.logic_operator}
                    onValueChange={(value: LogicOperator) =>
                      setFormData({ ...formData, logic_operator: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">UND (alle Bedingungen müssen erfüllt sein)</SelectItem>
                      <SelectItem value="OR">ODER (eine Bedingung muss erfüllt sein)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_active: checked })
                      }
                    />
                    <span className="text-sm">
                      {formData.is_active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSubmit}>
                {editingCondition ? "Speichern" : "Erstellen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bedingung löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Möchten Sie diese Bedingung wirklich löschen? Die Berechtigung wird
                dann ohne diese zusätzliche Einschränkung angewendet.
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

export default PermissionConditionsManager;
