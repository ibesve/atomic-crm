import { useState, useMemo } from "react";
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
import { Plus, Pencil, Trash2, User, Tags } from "lucide-react";
import type {
  UserAttribute,
  AttributeDefinition,
} from "../types/rbac";

interface Sale {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

interface UserAttributesManagerProps {
  className?: string;
  salesId?: number; // Optional: Wenn gesetzt, nur Attribute dieses Benutzers anzeigen
}

export function UserAttributesManager({
  className,
  salesId,
}: UserAttributesManagerProps) {
  const notify = useNotify();
  const refresh = useRefresh();
  const translate = useTranslate();
  const [create] = useCreate();
  const [update] = useUpdate();
  const [deleteOne] = useDelete();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<UserAttribute | null>(null);
  const [attributeToDelete, setAttributeToDelete] = useState<UserAttribute | null>(null);

  const [formData, setFormData] = useState({
    sales_id: salesId || 0,
    attribute_name: "",
    attribute_value: "",
  });

  // Benutzerattribute laden
  const { data: userAttributes, isLoading: attributesLoading } = useGetList<UserAttribute>(
    "user_attributes",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "attribute_name", order: "ASC" },
      filter: salesId ? { sales_id: salesId } : {},
    }
  );

  // Attribut-Definitionen laden
  const { data: attributeDefinitions } = useGetList<AttributeDefinition>(
    "attribute_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "name", order: "ASC" },
      filter: { "applies_to@cs": "{user}" }, // Nur Attribute die auf Benutzer anwendbar sind
    }
  );

  // Benutzer laden
  const { data: sales } = useGetList<Sale>("sales", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "last_name", order: "ASC" },
  });

  const resetForm = () => {
    setFormData({
      sales_id: salesId || 0,
      attribute_name: "",
      attribute_value: "",
    });
    setEditingAttribute(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (attr: UserAttribute) => {
    setEditingAttribute(attr);
    setFormData({
      sales_id: attr.sales_id,
      attribute_name: attr.attribute_name,
      attribute_value: attr.attribute_value,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.sales_id || !formData.attribute_name || !formData.attribute_value) {
      notify(translate("crm.rbac.all_fields_required"), { type: "error" });
      return;
    }

    try {
      if (editingAttribute) {
        await update(
          "user_attributes",
          {
            id: editingAttribute.id,
            data: formData,
            previousData: editingAttribute,
          },
          {
            onSuccess: () => {
              notify(translate("crm.rbac.attribute_updated"), { type: "success" });
              setIsDialogOpen(false);
              resetForm();
              refresh();
            },
          }
        );
      } else {
        await create(
          "user_attributes",
          { data: formData },
          {
            onSuccess: () => {
              notify(translate("crm.rbac.attribute_assigned"), { type: "success" });
              setIsDialogOpen(false);
              resetForm();
              refresh();
            },
          }
        );
      }
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : translate("crm.rbac.error_save"), { type: "error" });
    }
  };

  const handleDelete = async () => {
    if (!attributeToDelete) return;

    try {
      await deleteOne(
        "user_attributes",
        { id: attributeToDelete.id, previousData: attributeToDelete },
        {
          onSuccess: () => {
              notify(translate("crm.rbac.attribute_removed"), { type: "success" });
            setIsDeleteDialogOpen(false);
            setAttributeToDelete(null);
            refresh();
          },
        }
      );
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : translate("crm.rbac.error_delete"), { type: "error" });
    }
  };

  const getAttributeDefinition = (name: string): AttributeDefinition | undefined => {
    return attributeDefinitions?.find((d: AttributeDefinition) => d.name === name);
  };

  const getSalesName = (id: number): string => {
    const sale = sales?.find((s: Sale) => s.id === id);
    return sale ? `${sale.first_name} ${sale.last_name}` : `ID: ${id}`;
  };

  const selectedAttributeDef = getAttributeDefinition(formData.attribute_name);

  // Gruppiere Attribute nach Benutzer wenn kein salesId gesetzt ist
  const groupedAttributes = useMemo(() => {
    if (!userAttributes) return {} as Record<number, UserAttribute[]>;
    
    return userAttributes.reduce<Record<number, UserAttribute[]>>((acc, attr) => {
      if (!acc[attr.sales_id]) {
        acc[attr.sales_id] = [];
      }
      acc[attr.sales_id].push(attr);
      return acc;
    }, {});
  }, [userAttributes]);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {translate("crm.rbac.user_attributes")}
            </CardTitle>
            <CardDescription>
              {translate("crm.rbac.user_attributes_desc")}
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {translate("crm.rbac.assign_attribute")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {attributesLoading ? (
          <div className="text-center py-4 text-muted-foreground">{translate("crm.rbac.loading")}</div>
        ) : !userAttributes?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            {translate("crm.rbac.no_user_attributes")}
          </div>
        ) : salesId ? (
          // Einfache Tabelle wenn nur ein Benutzer
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translate("crm.rbac.attribute")}</TableHead>
                <TableHead>{translate("crm.rbac.value_label")}</TableHead>
                <TableHead className="w-[100px]">{translate("crm.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userAttributes.map((attr: UserAttribute) => {
                const def = getAttributeDefinition(attr.attribute_name);
                return (
                  <TableRow key={attr.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Tags className="h-4 w-4 text-muted-foreground" />
                        {def?.label || attr.attribute_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{attr.attribute_value}</Badge>
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
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          // Gruppierte Ansicht nach Benutzer
          <div className="space-y-4">
            {Object.entries(groupedAttributes).map(([sId, attrs]) => (
              <div key={sId} className="border rounded-lg p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {getSalesName(Number(sId))}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(attrs as UserAttribute[]).map((attr: UserAttribute) => {
                    const def = getAttributeDefinition(attr.attribute_name);
                    return (
                      <Badge
                        key={attr.id}
                        variant="outline"
                        className="gap-1 cursor-pointer hover:bg-secondary"
                        onClick={() => openEditDialog(attr)}
                      >
                        <span className="text-muted-foreground">
                          {def?.label || attr.attribute_name}:
                        </span>
                        {attr.attribute_value}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAttribute ? translate("crm.rbac.edit_attribute_dialog") : translate("crm.rbac.assign_attribute_dialog")}
              </DialogTitle>
              <DialogDescription>
                {translate("crm.rbac.assign_dialog_desc")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {!salesId && (
                <div className="space-y-2">
                  <Label>{translate("crm.rbac.user")}</Label>
                  <Select
                    value={formData.sales_id?.toString() || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, sales_id: Number(value) })
                    }
                    disabled={!!editingAttribute}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={translate("crm.rbac.select_user_label")} />
                    </SelectTrigger>
                    <SelectContent>
                      {sales?.map((s: Sale) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.first_name} {s.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>{translate("crm.rbac.attribute")}</Label>
                <Select
                  value={formData.attribute_name}
                  onValueChange={(value) =>
                    setFormData({ ...formData, attribute_name: value, attribute_value: "" })
                  }
                  disabled={!!editingAttribute}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={translate("crm.rbac.select_attribute")} />
                  </SelectTrigger>
                  <SelectContent>
                    {attributeDefinitions
                      ?.filter((d: AttributeDefinition) => d.applies_to.includes("user"))
                      .map((def: AttributeDefinition) => (
                        <SelectItem key={def.id} value={def.name}>
                          {def.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{translate("crm.rbac.value_label")}</Label>
                {selectedAttributeDef?.data_type === "select" &&
                selectedAttributeDef.allowed_values ? (
                  <Select
                    value={formData.attribute_value}
                    onValueChange={(value) =>
                      setFormData({ ...formData, attribute_value: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={translate("crm.rbac.select_value")} />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedAttributeDef.allowed_values.map((val) => (
                        <SelectItem key={val.value} value={val.value}>
                          {val.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={formData.attribute_value}
                    onChange={(e) =>
                      setFormData({ ...formData, attribute_value: e.target.value })
                    }
                    placeholder={translate("crm.rbac.enter_value")}
                    type={selectedAttributeDef?.data_type === "number" ? "number" : "text"}
                  />
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {translate("crm.cancel")}
              </Button>
              <Button onClick={handleSubmit}>
                {editingAttribute ? translate("crm.save") : translate("crm.rbac.assign")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{translate("crm.rbac.remove_attribute_title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {translate("crm.rbac.remove_attribute_desc", { name: attributeToDelete?.attribute_name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{translate("crm.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>{translate("crm.rbac.remove")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

export default UserAttributesManager;
