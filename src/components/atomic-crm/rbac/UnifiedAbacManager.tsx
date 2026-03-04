import { useState, useMemo } from "react";
import {
  useGetList,
  useCreate,
  useUpdate,
  useDelete,
  useNotify,
  useRefresh,
  useTranslate,
  useDataProvider,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Pencil,
  Trash2,
  Tags,
  Shield,
  User,
  X,
  Zap,
  Filter,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";
import type {
  AttributeDefinition,
  AttributeDataType,
  AttributeAppliesTo,
  AttributeAllowedValue,
  UserAttribute,
  PermissionCondition,
  RolePermission,
  ConditionOperator,
  ConditionSourceType,
  ConditionType,
  LogicOperator,
  ResourceType,
  Role,
} from "../types/rbac";
import {
  ATTRIBUTE_DATA_TYPES,
  CONDITION_OPERATORS,
  SOURCE_TYPES,
  RESOURCE_FIELDS,
} from "../types/rbac";

// =====================================================
// Quick Presets for common access patterns
// =====================================================

interface AccessPreset {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  resource: string;
  conditions: Array<{
    target_field: string;
    operator: ConditionOperator;
    source_type: ConditionSourceType;
    source_attribute?: string;
    static_values?: string[];
  }>;
}

const ACCESS_PRESETS: AccessPreset[] = [
  {
    id: "own_contacts",
    label: "Nur eigene Kontakte",
    description: "Benutzer sehen nur Kontakte, die ihnen zugewiesen sind.",
    icon: User,
    resource: "contacts",
    conditions: [
      { target_field: "sales_id", operator: "=", source_type: "current_user" },
    ],
  },
  {
    id: "own_companies",
    label: "Nur eigene Unternehmen",
    description: "Benutzer sehen nur Unternehmen, die ihnen zugewiesen sind.",
    icon: User,
    resource: "companies",
    conditions: [
      { target_field: "sales_id", operator: "=", source_type: "current_user" },
    ],
  },
  {
    id: "own_deals",
    label: "Nur eigene Deals",
    description: "Benutzer sehen nur eigene Deals.",
    icon: User,
    resource: "deals",
    conditions: [
      { target_field: "sales_id", operator: "=", source_type: "current_user" },
    ],
  },
  {
    id: "own_tasks",
    label: "Nur eigene Aufgaben",
    description: "Benutzer sehen nur Aufgaben, die ihnen zugewiesen sind.",
    icon: User,
    resource: "tasks",
    conditions: [
      { target_field: "sales_id", operator: "=", source_type: "current_user" },
    ],
  },
  {
    id: "region_contacts",
    label: "Kontakte nach Region",
    description: "Benutzer sehen nur Kontakte aus ihrer Region (benötigt Attribut 'region').",
    icon: Tags,
    resource: "contacts",
    conditions: [
      {
        target_field: "sales_id",
        operator: "=",
        source_type: "user_attribute",
        source_attribute: "region",
      },
    ],
  },
];

// Resource labels
const RESOURCE_LABELS: Record<string, string> = {
  contacts: "Kontakte",
  companies: "Unternehmen",
  deals: "Deals",
  tasks: "Aufgaben",
  contact_notes: "Kontakt-Notizen",
  deal_notes: "Deal-Notizen",
  sales: "Benutzer",
  roles: "Rollen",
  teams: "Teams",
};

// All available resources as shortcuts
const ALL_RESOURCES: Array<{ value: string; label: string }> = [
  { value: "contacts", label: "Kontakte" },
  { value: "companies", label: "Unternehmen" },
  { value: "deals", label: "Deals" },
  { value: "tasks", label: "Aufgaben" },
  { value: "contact_notes", label: "Kontakt-Notizen" },
  { value: "deal_notes", label: "Deal-Notizen" },
  { value: "sales", label: "Benutzer" },
];

interface UnifiedAbacManagerProps {
  className?: string;
}

export function UnifiedAbacManager({ className }: UnifiedAbacManagerProps) {
  const notify = useNotify();
  const refresh = useRefresh();
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const [create] = useCreate();
  const [update] = useUpdate();
  const [deleteOne] = useDelete();

  // ==================== DATA ====================
  const { data: roles } = useGetList<Role>("roles", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "name", order: "ASC" },
  });

  const { data: permissions } = useGetList<RolePermission>("role_permissions", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "resource", order: "ASC" },
  });

  const { data: conditions, isLoading: conditionsLoading } = useGetList<PermissionCondition>(
    "permission_conditions",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
    },
  );

  const { data: attributes, isLoading: attrsLoading } = useGetList<AttributeDefinition>(
    "attribute_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "name", order: "ASC" },
    },
  );

  const { data: userAttributes } = useGetList<UserAttribute>("user_attributes", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "sales_id", order: "ASC" },
  });

  interface Sale {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  }

  const { data: sales } = useGetList<Sale>("sales", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "first_name", order: "ASC" },
  });

  // ==================== STATE ====================
  const [activeSubTab, setActiveSubTab] = useState("overview");

  // Condition dialog
  const [isConditionDialogOpen, setIsConditionDialogOpen] = useState(false);
  const [editingCondition, setEditingCondition] = useState<PermissionCondition | null>(null);
  const [conditionForm, setConditionForm] = useState({
    role_permission_id: 0,
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
  const [conditionToDelete, setConditionToDelete] = useState<PermissionCondition | null>(null);

  // Quick preset dialog
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<AccessPreset | null>(null);
  const [presetRoleId, setPresetRoleId] = useState<string>("");

  // Attribute dialog
  const [isAttrDialogOpen, setIsAttrDialogOpen] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<AttributeDefinition | null>(null);
  const [attrForm, setAttrForm] = useState({
    name: "",
    label: "",
    description: "",
    data_type: "text" as AttributeDataType,
    allowed_values: [] as AttributeAllowedValue[],
    applies_to: ["user"] as AttributeAppliesTo[],
  });
  const [newAllowedValue, setNewAllowedValue] = useState({ value: "", label: "" });
  const [attrToDelete, setAttrToDelete] = useState<AttributeDefinition | null>(null);

  // User attribute assignment
  const [isUserAttrDialogOpen, setIsUserAttrDialogOpen] = useState(false);
  const [userAttrForm, setUserAttrForm] = useState({
    sales_id: 0,
    attribute_name: "",
    attribute_value: "",
  });
  const [editingUserAttr, setEditingUserAttr] = useState<UserAttribute | null>(null);
  const [userAttrToDelete, setUserAttrToDelete] = useState<UserAttribute | null>(null);

  // ==================== HELPERS ====================
  const getPermissionLabel = (permId: number): string => {
    const perm = permissions?.find((p) => p.id === permId);
    return perm ? `${RESOURCE_LABELS[perm.resource] || perm.resource} → ${perm.action}` : `ID: ${permId}`;
  };

  const getRoleName = (roleId: number): string => {
    const role = roles?.find((r) => r.id === roleId);
    return role?.name || `Rolle ${roleId}`;
  };

  const getPermissionsByRole = (roleId: number): RolePermission[] => {
    return permissions?.filter((p) => p.role_id === roleId) || [];
  };

  const getResourceFields = (permId?: number) => {
    const perm = permissions?.find((p) => p.id === (permId || conditionForm.role_permission_id));
    if (perm) {
      return RESOURCE_FIELDS[perm.resource as ResourceType] || [];
    }
    return [];
  };

  const formatCondition = (condition: PermissionCondition): string => {
    const operatorLabel = CONDITION_OPERATORS[condition.operator];
    let valueDisplay = "";
    if (condition.source_type === "current_user") {
      valueDisplay = "aktueller Benutzer";
    } else if (condition.source_type === "static_value") {
      valueDisplay = condition.source_attribute || "";
    } else if (condition.operator === "IN" || condition.operator === "NOT IN") {
      valueDisplay = `[${condition.static_values?.join(", ")}]`;
    } else {
      valueDisplay = `${SOURCE_TYPES[condition.source_type]}: ${condition.source_attribute}`;
    }
    return `${condition.target_field} ${operatorLabel} ${valueDisplay}`;
  };

  // Grouped conditions by role -> permission for overview
  const conditionsByRole = useMemo(() => {
    if (!conditions || !permissions || !roles) return [];
    const result: Array<{
      role: Role;
      permissions: Array<{
        permission: RolePermission;
        conditions: PermissionCondition[];
      }>;
    }> = [];

    for (const role of roles) {
      const rolePerms = permissions.filter((p) => p.role_id === role.id);
      const rolePCs: Array<{
        permission: RolePermission;
        conditions: PermissionCondition[];
      }> = [];
      for (const perm of rolePerms) {
        const permConditions = conditions.filter((c) => c.role_permission_id === perm.id);
        if (permConditions.length > 0) {
          rolePCs.push({ permission: perm, conditions: permConditions });
        }
      }
      if (rolePCs.length > 0) {
        result.push({ role, permissions: rolePCs });
      }
    }
    return result;
  }, [conditions, permissions, roles]);

  // ==================== CONDITION HANDLERS ====================
  const resetConditionForm = () => {
    setConditionForm({
      role_permission_id: 0,
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

  const openConditionCreate = () => {
    resetConditionForm();
    setIsConditionDialogOpen(true);
  };

  const openConditionEdit = (condition: PermissionCondition) => {
    setEditingCondition(condition);
    setConditionForm({
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
    setIsConditionDialogOpen(true);
  };

  const handleConditionSave = async () => {
    if (!conditionForm.role_permission_id || !conditionForm.target_field) {
      notify("Bitte Berechtigung und Zielfeld auswählen.", { type: "error" });
      return;
    }
    try {
      const data = {
        ...conditionForm,
        static_values:
          conditionForm.operator === "IN" || conditionForm.operator === "NOT IN"
            ? conditionForm.static_values
            : null,
        source_attribute:
          conditionForm.source_type === "static_value"
            ? conditionForm.static_values[0] || conditionForm.source_attribute
            : conditionForm.source_attribute,
      };

      if (editingCondition) {
        await update(
          "permission_conditions",
          { id: editingCondition.id, data, previousData: editingCondition },
          { returnPromise: true },
        );
        notify("Bedingung aktualisiert.", { type: "success" });
      } else {
        await create("permission_conditions", { data }, { returnPromise: true });
        notify("Bedingung erstellt.", { type: "success" });
      }
      setIsConditionDialogOpen(false);
      resetConditionForm();
      refresh();
    } catch (error: unknown) {
      notify(
        error instanceof Error ? error.message : "Fehler beim Speichern.",
        { type: "error" },
      );
    }
  };

  const handleConditionDelete = async () => {
    if (!conditionToDelete) return;
    try {
      await deleteOne(
        "permission_conditions",
        { id: conditionToDelete.id, previousData: conditionToDelete },
        { returnPromise: true },
      );
      notify("Bedingung gelöscht.", { type: "success" });
      setConditionToDelete(null);
      refresh();
    } catch {
      notify("Fehler beim Löschen.", { type: "error" });
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
        { returnPromise: true },
      );
      notify(condition.is_active ? "Bedingung deaktiviert." : "Bedingung aktiviert.", {
        type: "success",
      });
      refresh();
    } catch {
      notify("Fehler.", { type: "error" });
    }
  };

  const addStaticValue = () => {
    if (!newStaticValue) return;
    setConditionForm({
      ...conditionForm,
      static_values: [...conditionForm.static_values, newStaticValue],
    });
    setNewStaticValue("");
  };

  // ==================== PRESET HANDLER ====================
  const applyPreset = async () => {
    if (!selectedPreset || !presetRoleId) {
      notify("Bitte eine Rolle auswählen.", { type: "error" });
      return;
    }

    const roleId = Number(presetRoleId);
    const rolePerms = getPermissionsByRole(roleId);

    // Find matching permissions for this resource (all actions)
    const matchingPerms = rolePerms.filter(
      (p) => p.resource === selectedPreset.resource,
    );

    if (matchingPerms.length === 0) {
      // Create a "list" permission for this resource first, then attach conditions
      try {
        const { data: newPerm } = await dataProvider.create<RolePermission>("role_permissions", {
          data: {
            role_id: roleId,
            resource: selectedPreset.resource,
            action: "list",
            scope: "all",
          },
        });

        for (const cond of selectedPreset.conditions) {
          await create(
            "permission_conditions",
            {
              data: {
                role_permission_id: newPerm.id,
                condition_type: "attribute_match",
                target_field: cond.target_field,
                operator: cond.operator,
                source_type: cond.source_type,
                source_attribute: cond.source_attribute || null,
                static_values: cond.static_values || null,
                logic_operator: "AND",
                is_active: true,
              },
            },
            { returnPromise: true },
          );
        }
        notify(`Zugriffsregel "${selectedPreset.label}" angewendet.`, { type: "success" });
      } catch (error: unknown) {
        notify(
          error instanceof Error ? error.message : "Fehler beim Anwenden.",
          { type: "error" },
        );
      }
    } else {
      // Attach conditions to all matching permissions
      try {
        for (const perm of matchingPerms) {
          for (const cond of selectedPreset.conditions) {
            await create(
              "permission_conditions",
              {
                data: {
                  role_permission_id: perm.id,
                  condition_type: "attribute_match",
                  target_field: cond.target_field,
                  operator: cond.operator,
                  source_type: cond.source_type,
                  source_attribute: cond.source_attribute || null,
                  static_values: cond.static_values || null,
                  logic_operator: "AND",
                  is_active: true,
                },
              },
              { returnPromise: true },
            );
          }
        }
        notify(`Zugriffsregel "${selectedPreset.label}" angewendet.`, { type: "success" });
      } catch (error: unknown) {
        notify(
          error instanceof Error ? error.message : "Fehler beim Anwenden.",
          { type: "error" },
        );
      }
    }

    setPresetDialogOpen(false);
    setSelectedPreset(null);
    setPresetRoleId("");
    refresh();
  };

  // ==================== ATTRIBUTE HANDLERS ====================
  const resetAttrForm = () => {
    setAttrForm({
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

  const openAttrCreate = () => {
    resetAttrForm();
    setIsAttrDialogOpen(true);
  };

  const openAttrEdit = (attr: AttributeDefinition) => {
    setEditingAttribute(attr);
    setAttrForm({
      name: attr.name,
      label: attr.label,
      description: attr.description || "",
      data_type: attr.data_type,
      allowed_values: attr.allowed_values || [],
      applies_to: attr.applies_to,
    });
    setIsAttrDialogOpen(true);
  };

  const handleAttrSave = async () => {
    if (!attrForm.name || !attrForm.label) {
      notify("Name und Label sind Pflichtfelder.", { type: "error" });
      return;
    }
    try {
      const data = {
        ...attrForm,
        allowed_values: attrForm.data_type === "select" ? attrForm.allowed_values : null,
      };
      if (editingAttribute) {
        await update(
          "attribute_definitions",
          { id: editingAttribute.id, data, previousData: editingAttribute },
          { returnPromise: true },
        );
        notify("Attribut aktualisiert.", { type: "success" });
      } else {
        await create("attribute_definitions", { data }, { returnPromise: true });
        notify("Attribut erstellt.", { type: "success" });
      }
      setIsAttrDialogOpen(false);
      resetAttrForm();
      refresh();
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Fehler.", { type: "error" });
    }
  };

  const handleAttrDelete = async () => {
    if (!attrToDelete) return;
    try {
      await deleteOne(
        "attribute_definitions",
        { id: attrToDelete.id, previousData: attrToDelete },
        { returnPromise: true },
      );
      notify("Attribut gelöscht.", { type: "success" });
      setAttrToDelete(null);
      refresh();
    } catch {
      notify("Fehler beim Löschen.", { type: "error" });
    }
  };

  // ==================== USER ATTRIBUTE HANDLERS ====================
  const resetUserAttrForm = () => {
    setUserAttrForm({ sales_id: 0, attribute_name: "", attribute_value: "" });
    setEditingUserAttr(null);
  };

  const openUserAttrCreate = () => {
    resetUserAttrForm();
    setIsUserAttrDialogOpen(true);
  };

  const openUserAttrEdit = (ua: UserAttribute) => {
    setEditingUserAttr(ua);
    setUserAttrForm({
      sales_id: ua.sales_id,
      attribute_name: ua.attribute_name,
      attribute_value: ua.attribute_value,
    });
    setIsUserAttrDialogOpen(true);
  };

  const handleUserAttrSave = async () => {
    if (!userAttrForm.sales_id || !userAttrForm.attribute_name || !userAttrForm.attribute_value) {
      notify("Alle Felder sind Pflichtfelder.", { type: "error" });
      return;
    }
    try {
      if (editingUserAttr) {
        await update(
          "user_attributes",
          { id: editingUserAttr.id, data: userAttrForm, previousData: editingUserAttr },
          { returnPromise: true },
        );
        notify("Zuordnung aktualisiert.", { type: "success" });
      } else {
        await create("user_attributes", { data: userAttrForm }, { returnPromise: true });
        notify("Attribut zugeordnet.", { type: "success" });
      }
      setIsUserAttrDialogOpen(false);
      resetUserAttrForm();
      refresh();
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Fehler.", { type: "error" });
    }
  };

  const handleUserAttrDelete = async () => {
    if (!userAttrToDelete) return;
    try {
      await deleteOne(
        "user_attributes",
        { id: userAttrToDelete.id, previousData: userAttrToDelete },
        { returnPromise: true },
      );
      notify("Zuordnung entfernt.", { type: "success" });
      setUserAttrToDelete(null);
      refresh();
    } catch {
      notify("Fehler beim Löschen.", { type: "error" });
    }
  };

  const getAttrDefinition = (name: string) => attributes?.find((a) => a.name === name);
  const getSaleName = (id: number) => {
    const s = sales?.find((s: Sale) => s.id === id);
    return s ? `${s.first_name} ${s.last_name}` : `ID: ${id}`;
  };

  // Get allowed values for an attribute
  const getAttrAllowedValues = (attrName: string): AttributeAllowedValue[] => {
    const def = getAttrDefinition(attrName);
    return def?.allowed_values || [];
  };

  // ==================== RENDER ====================
  return (
    <div className={className}>
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview" className="gap-1.5">
            <Filter className="h-4 w-4" />
            Zugriffsregeln
          </TabsTrigger>
          <TabsTrigger value="attributes" className="gap-1.5">
            <Tags className="h-4 w-4" />
            Attribute & Zuordnungen
          </TabsTrigger>
        </TabsList>

        {/* ===================== TAB 1: Overview & Conditions ===================== */}
        <TabsContent value="overview" className="space-y-4">
          {/* Quick Presets */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                Schnellvorlagen
              </CardTitle>
              <CardDescription>
                Häufige Zugriffsregeln mit einem Klick anwenden. Wählen Sie eine Vorlage und die Rolle, auf die sie angewendet werden soll.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ACCESS_PRESETS.map((preset) => {
                  const PresetIcon = preset.icon;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setSelectedPreset(preset);
                        setPresetRoleId("");
                        setPresetDialogOpen(true);
                      }}
                      className="text-left p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <PresetIcon className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{preset.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{preset.description}</p>
                      <Badge variant="outline" className="mt-2 text-xs">
                        {RESOURCE_LABELS[preset.resource] || preset.resource}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Active Conditions */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Aktive Zugriffsregeln
                  </CardTitle>
                  <CardDescription>
                    Bedingungen, die den Zugriff auf Datensätze einschränken.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={openConditionCreate}>
                  <Plus className="h-4 w-4 mr-1" />
                  Bedingung hinzufügen
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {conditionsLoading ? (
                <div className="text-center py-4 text-muted-foreground">Laden...</div>
              ) : conditionsByRole.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Filter className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">Keine Zugriffsregeln aktiv</p>
                  <p className="text-sm mt-1">
                    Verwenden Sie die Schnellvorlagen oben oder erstellen Sie eine benutzerdefinierte Bedingung.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {conditionsByRole.map(({ role, permissions: rolePerms }) => (
                    <div key={role.id} className="border rounded-lg overflow-hidden">
                      <div className="bg-muted px-4 py-2 font-medium text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {role.name}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ressource</TableHead>
                            <TableHead>Bedingung</TableHead>
                            <TableHead>Logik</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[100px]">Aktionen</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rolePerms.flatMap(({ permission, conditions: permConds }) =>
                            permConds.map((cond) => (
                              <TableRow key={cond.id}>
                                <TableCell>
                                  <Badge variant="outline">
                                    {RESOURCE_LABELS[permission.resource] || permission.resource}.{permission.action}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <code className="text-xs bg-muted px-2 py-0.5 rounded">
                                    {formatCondition(cond)}
                                  </code>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={cond.logic_operator === "AND" ? "default" : "secondary"}>
                                    {cond.logic_operator}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {cond.is_active ? (
                                    <Badge variant="default" className="gap-1 text-xs">
                                      <CheckCircle className="h-3 w-3" />
                                      Aktiv
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="gap-1 text-xs">
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
                                      className="h-7 w-7"
                                      onClick={() => toggleConditionActive(cond)}
                                    >
                                      {cond.is_active ? (
                                        <XCircle className="h-3.5 w-3.5" />
                                      ) : (
                                        <CheckCircle className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => openConditionEdit(cond)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => setConditionToDelete(cond)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )),
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== TAB 2: Attributes & User Assignments ===================== */}
        <TabsContent value="attributes" className="space-y-4">
          {/* Info box */}
          <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
            <CardContent className="py-3 flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">So funktionieren Attribute</p>
                <ol className="mt-1 text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                  <li><strong>Attribut definieren</strong> — z.B. &quot;Region&quot; mit Werten DACH, Nordics, UK</li>
                  <li><strong>Benutzern zuordnen</strong> — z.B. Max Mustermann → Region = &quot;DACH&quot;</li>
                  <li><strong>In Zugriffsregeln verwenden</strong> — z.B. &quot;Kontakte nur anzeigen, wenn Region des Benutzers = Region des Kontakts&quot;</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Attribute Definitions */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tags className="h-4 w-4" />
                    Attribute
                  </CardTitle>
                  <CardDescription>
                    Definieren Sie Attribute wie &quot;Region&quot;, &quot;Abteilung&quot; oder &quot;Standort&quot;, die Benutzern zugeordnet werden können.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={openAttrCreate}>
                  <Plus className="h-4 w-4 mr-1" />
                  Attribut erstellen
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {attrsLoading ? (
                <div className="text-center py-4 text-muted-foreground">Laden...</div>
              ) : !attributes?.length ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Tags className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>Noch keine Attribute definiert.</p>
                  <p className="text-sm mt-1">
                    Erstellen Sie ein Attribut, um Benutzern Eigenschaften zuzuordnen.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Werte</TableHead>
                      <TableHead className="w-[80px]">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attributes.map((attr) => (
                      <TableRow key={attr.id}>
                        <TableCell className="font-mono text-sm">{attr.name}</TableCell>
                        <TableCell>{attr.label}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{ATTRIBUTE_DATA_TYPES[attr.data_type]}</Badge>
                        </TableCell>
                        <TableCell>
                          {attr.allowed_values && attr.allowed_values.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {attr.allowed_values.map((v) => (
                                <Badge key={v.value} variant="secondary" className="text-xs">
                                  {v.label}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Freitext</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAttrEdit(attr)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {!attr.is_system && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAttrToDelete(attr)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* User Attribute Assignments */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Benutzer-Zuordnungen
                  </CardTitle>
                  <CardDescription>
                    Ordnen Sie Benutzern Attributwerte zu (z.B. Max Mustermann → Region = &quot;DACH&quot;).
                  </CardDescription>
                </div>
                <Button size="sm" onClick={openUserAttrCreate} disabled={!attributes?.length}>
                  <Plus className="h-4 w-4 mr-1" />
                  Zuordnung hinzufügen
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!userAttributes?.length ? (
                <div className="text-center py-6 text-muted-foreground">
                  <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>Noch keine Zuordnungen vorhanden.</p>
                  {!attributes?.length && (
                    <p className="text-sm mt-1">Erstellen Sie zuerst ein Attribut oben.</p>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Benutzer</TableHead>
                      <TableHead>Attribut</TableHead>
                      <TableHead>Wert</TableHead>
                      <TableHead className="w-[80px]">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userAttributes.map((ua: UserAttribute) => (
                      <TableRow key={ua.id}>
                        <TableCell className="font-medium">{getSaleName(ua.sales_id)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <Tags className="h-3 w-3" />
                            {getAttrDefinition(ua.attribute_name)?.label || ua.attribute_name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{ua.attribute_value}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openUserAttrEdit(ua)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setUserAttrToDelete(ua)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===================== DIALOGS ===================== */}

      {/* Preset Apply Dialog */}
      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPreset?.label}</DialogTitle>
            <DialogDescription>{selectedPreset?.description}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Auf welche Rolle anwenden?</Label>
              <Select value={presetRoleId} onValueChange={setPresetRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Rolle auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {roles?.map((r) => (
                    <SelectItem key={r.id} value={r.id.toString()}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedPreset && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="font-medium mb-1">Wird erstellt:</p>
                {selectedPreset.conditions.map((cond, i) => (
                  <code key={i} className="block text-xs">
                    {RESOURCE_LABELS[selectedPreset.resource]}.* → {cond.target_field}{" "}
                    {CONDITION_OPERATORS[cond.operator]}{" "}
                    {cond.source_type === "current_user"
                      ? "aktueller Benutzer"
                      : `${SOURCE_TYPES[cond.source_type]}: ${cond.source_attribute}`}
                  </code>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPresetDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={applyPreset} disabled={!presetRoleId}>
              <Zap className="h-4 w-4 mr-2" />
              Anwenden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Condition Create/Edit Dialog */}
      <Dialog open={isConditionDialogOpen} onOpenChange={setIsConditionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCondition ? "Bedingung bearbeiten" : "Neue Bedingung erstellen"}
            </DialogTitle>
            <DialogDescription>
              Definieren Sie, welche Datensätze für eine Berechtigung sichtbar/änderbar sind.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Permission selection */}
            <div className="space-y-2">
              <Label>Berechtigung</Label>
              <Select
                value={conditionForm.role_permission_id?.toString() || ""}
                onValueChange={(v) =>
                  setConditionForm({ ...conditionForm, role_permission_id: Number(v), target_field: "" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Rolle → Ressource.Aktion auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {roles?.map((role) => {
                    const rolePerms = getPermissionsByRole(role.id);
                    if (rolePerms.length === 0) return null;
                    return rolePerms.map((perm) => (
                      <SelectItem key={perm.id} value={perm.id.toString()}>
                        {role.name} → {RESOURCE_LABELS[perm.resource] || perm.resource}.{perm.action}
                      </SelectItem>
                    ));
                  })}
                </SelectContent>
              </Select>
              {!permissions?.length && (
                <p className="text-xs text-amber-600">
                  Keine Berechtigungen vorhanden. Erstellen Sie zuerst Rollen mit Berechtigungen im Tab &quot;Rollen &amp; Berechtigungen&quot;.
                </p>
              )}
            </div>

            {/* Target field + Operator */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Feld</Label>
                <Select
                  value={conditionForm.target_field}
                  onValueChange={(v) => setConditionForm({ ...conditionForm, target_field: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Feld auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getResourceFields().map((field) => (
                      <SelectItem key={field.field} value={field.field}>
                        {field.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="_custom">Benutzerdefiniert...</SelectItem>
                  </SelectContent>
                </Select>
                {conditionForm.target_field === "_custom" && (
                  <Input
                    placeholder="Feldname eingeben"
                    onChange={(e) => setConditionForm({ ...conditionForm, target_field: e.target.value })}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Operator</Label>
                <Select
                  value={conditionForm.operator}
                  onValueChange={(v: ConditionOperator) => setConditionForm({ ...conditionForm, operator: v })}
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

            {/* Source */}
            <div className="space-y-2">
              <Label>Vergleich mit</Label>
              <Select
                value={conditionForm.source_type}
                onValueChange={(v: ConditionSourceType) =>
                  setConditionForm({ ...conditionForm, source_type: v, source_attribute: "" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current_user">Aktueller Benutzer (sales_id)</SelectItem>
                  <SelectItem value="user_attribute">Benutzerattribut</SelectItem>
                  <SelectItem value="static_value">Fester Wert</SelectItem>
                  <SelectItem value="role_attribute">Rollenattribut</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Source attribute (for user_attribute / role_attribute) */}
            {(conditionForm.source_type === "user_attribute" ||
              conditionForm.source_type === "role_attribute") && (
              <div className="space-y-2">
                <Label>Attribut</Label>
                <Select
                  value={conditionForm.source_attribute}
                  onValueChange={(v) => setConditionForm({ ...conditionForm, source_attribute: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Attribut auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {attributes
                      ?.filter((d) =>
                        conditionForm.source_type === "user_attribute"
                          ? d.applies_to.includes("user")
                          : d.applies_to.includes("role"),
                      )
                      .map((def) => (
                        <SelectItem key={def.id} value={def.name}>
                          {def.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Static value */}
            {conditionForm.source_type === "static_value" && (
              <div className="space-y-2">
                <Label>Wert</Label>
                {conditionForm.operator === "IN" || conditionForm.operator === "NOT IN" ? (
                  <>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Wert hinzufügen..."
                        value={newStaticValue}
                        onChange={(e) => setNewStaticValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStaticValue())}
                      />
                      <Button type="button" variant="outline" onClick={addStaticValue}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {conditionForm.static_values.map((val, idx) => (
                        <Badge key={idx} variant="secondary" className="gap-1">
                          {val}
                          <button
                            type="button"
                            onClick={() =>
                              setConditionForm({
                                ...conditionForm,
                                static_values: conditionForm.static_values.filter((_, i) => i !== idx),
                              })
                            }
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
                    value={conditionForm.source_attribute}
                    onChange={(e) => setConditionForm({ ...conditionForm, source_attribute: e.target.value })}
                    placeholder="Wert eingeben..."
                  />
                )}
              </div>
            )}

            {/* Logic + Active */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Verknüpfung</Label>
                <Select
                  value={conditionForm.logic_operator}
                  onValueChange={(v: LogicOperator) => setConditionForm({ ...conditionForm, logic_operator: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">UND (alle Bedingungen)</SelectItem>
                    <SelectItem value="OR">ODER (eine Bedingung)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Aktiv</Label>
                <div className="flex items-center gap-2 h-9">
                  <Switch
                    checked={conditionForm.is_active}
                    onCheckedChange={(v) => setConditionForm({ ...conditionForm, is_active: v })}
                  />
                  <span className="text-sm">{conditionForm.is_active ? "Aktiv" : "Inaktiv"}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConditionDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleConditionSave}>
              {editingCondition ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attribute Create/Edit Dialog */}
      <Dialog open={isAttrDialogOpen} onOpenChange={setIsAttrDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAttribute ? "Attribut bearbeiten" : "Neues Attribut"}</DialogTitle>
            <DialogDescription>
              Attribute definieren Eigenschaften, die Benutzern zugeordnet werden können (z.B. Region, Abteilung).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Technischer Name</Label>
                <Input
                  value={attrForm.name}
                  onChange={(e) =>
                    setAttrForm({ ...attrForm, name: e.target.value.toLowerCase().replace(/\s/g, "_") })
                  }
                  placeholder="z.B. region"
                  disabled={editingAttribute?.is_system}
                />
              </div>
              <div className="space-y-2">
                <Label>Anzeigename</Label>
                <Input
                  value={attrForm.label}
                  onChange={(e) => setAttrForm({ ...attrForm, label: e.target.value })}
                  placeholder="z.B. Region"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Textarea
                value={attrForm.description}
                onChange={(e) => setAttrForm({ ...attrForm, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Datentyp</Label>
              <Select
                value={attrForm.data_type}
                onValueChange={(v: AttributeDataType) => setAttrForm({ ...attrForm, data_type: v })}
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

            {attrForm.data_type === "select" && (
              <div className="space-y-2">
                <Label>Erlaubte Werte</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Wert"
                    value={newAllowedValue.value}
                    onChange={(e) => setNewAllowedValue({ ...newAllowedValue, value: e.target.value })}
                  />
                  <Input
                    placeholder="Label"
                    value={newAllowedValue.label}
                    onChange={(e) => setNewAllowedValue({ ...newAllowedValue, label: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (!newAllowedValue.value || !newAllowedValue.label) return;
                      setAttrForm({
                        ...attrForm,
                        allowed_values: [...attrForm.allowed_values, { ...newAllowedValue }],
                      });
                      setNewAllowedValue({ value: "", label: "" });
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {attrForm.allowed_values.map((val, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {val.label} ({val.value})
                      <button
                        type="button"
                        onClick={() =>
                          setAttrForm({
                            ...attrForm,
                            allowed_values: attrForm.allowed_values.filter((_, i) => i !== index),
                          })
                        }
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
            <Button variant="outline" onClick={() => setIsAttrDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAttrSave}>
              {editingAttribute ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Attribute Dialog */}
      <Dialog open={isUserAttrDialogOpen} onOpenChange={setIsUserAttrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUserAttr ? "Zuordnung bearbeiten" : "Attribut zuordnen"}</DialogTitle>
            <DialogDescription>
              Ordnen Sie einem Benutzer einen Attributwert zu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Benutzer</Label>
              <Select
                value={userAttrForm.sales_id?.toString() || ""}
                onValueChange={(v) => setUserAttrForm({ ...userAttrForm, sales_id: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Benutzer auswählen..." />
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

            <div className="space-y-2">
              <Label>Attribut</Label>
              <Select
                value={userAttrForm.attribute_name}
                onValueChange={(v) => setUserAttrForm({ ...userAttrForm, attribute_name: v, attribute_value: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Attribut auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {attributes?.map((a) => (
                    <SelectItem key={a.id} value={a.name}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Wert</Label>
              {getAttrAllowedValues(userAttrForm.attribute_name).length > 0 ? (
                <Select
                  value={userAttrForm.attribute_value}
                  onValueChange={(v) => setUserAttrForm({ ...userAttrForm, attribute_value: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wert auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getAttrAllowedValues(userAttrForm.attribute_name).map((av) => (
                      <SelectItem key={av.value} value={av.value}>
                        {av.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={userAttrForm.attribute_value}
                  onChange={(e) => setUserAttrForm({ ...userAttrForm, attribute_value: e.target.value })}
                  placeholder="Wert eingeben..."
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserAttrDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleUserAttrSave}>
              {editingUserAttr ? "Speichern" : "Zuordnen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Condition Confirmation */}
      <AlertDialog open={!!conditionToDelete} onOpenChange={(open) => !open && setConditionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bedingung löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diese Zugriffsregel wirklich entfernen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleConditionDelete} className="bg-red-600 hover:bg-red-700">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Attribute Confirmation */}
      <AlertDialog open={!!attrToDelete} onOpenChange={(open) => !open && setAttrToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Attribut löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie das Attribut &quot;{attrToDelete?.label}&quot; wirklich löschen? Alle Zuordnungen gehen verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleAttrDelete} className="bg-red-600 hover:bg-red-700">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Attribute Confirmation */}
      <AlertDialog open={!!userAttrToDelete} onOpenChange={(open) => !open && setUserAttrToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zuordnung entfernen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diese Attribut-Zuordnung wirklich entfernen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleUserAttrDelete} className="bg-red-600 hover:bg-red-700">
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default UnifiedAbacManager;
