import { useState } from "react";
import {
  useGetList,
  useCreate,
  useDelete,
  useNotify,
  useRefresh,
  useTranslate,
} from "ra-core";
import { Plus, Trash2, UserPlus, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Role } from "../types/rbac";

interface Sale {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

interface UserRole {
  id: number;
  sales_id: number;
  role_id: number;
  created_at: string;
}

interface UserRoleAssignmentProps {
  /** Optional: restrict to a specific role */
  roleId?: number;
  className?: string;
}

export function UserRoleAssignment({ roleId, className }: UserRoleAssignmentProps) {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [create] = useCreate();
  const [deleteOne] = useDelete();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSalesId, setSelectedSalesId] = useState<string>("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>(roleId?.toString() || "");

  const { data: userRoles, isLoading } = useGetList<UserRole>("user_roles", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "id", order: "ASC" },
    filter: roleId ? { role_id: roleId } : {},
  });

  const { data: roles } = useGetList<Role>("roles", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "name", order: "ASC" },
  });

  const { data: sales } = useGetList<Sale>("sales", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "last_name", order: "ASC" },
  });

  const handleAssign = async () => {
    if (!selectedSalesId || (!roleId && !selectedRoleId)) return;

    const targetRoleId = roleId || parseInt(selectedRoleId);
    const targetSalesId = parseInt(selectedSalesId);

    // Check if already assigned
    const existing = userRoles?.find(
      (ur) => ur.sales_id === targetSalesId && ur.role_id === targetRoleId
    );
    if (existing) {
      notify(translate("crm.rbac.user_already_assigned", { _: "Benutzer ist bereits zugewiesen" }), { type: "warning" });
      return;
    }

    try {
      await create("user_roles", {
        data: {
          sales_id: targetSalesId,
          role_id: targetRoleId,
        },
      }, { returnPromise: true });
      notify(translate("crm.rbac.user_assigned", { _: "Benutzer zugewiesen" }), { type: "success" });
      setIsDialogOpen(false);
      setSelectedSalesId("");
      if (!roleId) setSelectedRoleId("");
      refresh();
    } catch {
      notify(translate("crm.rbac.error", { _: "Fehler" }), { type: "error" });
    }
  };

  const handleRemove = async (userRoleId: number) => {
    try {
      await deleteOne("user_roles", {
        id: userRoleId,
        previousData: { id: userRoleId },
      }, { returnPromise: true });
      notify(translate("crm.rbac.user_unassigned", { _: "Zuweisung entfernt" }), { type: "success" });
      refresh();
    } catch {
      notify(translate("crm.rbac.error", { _: "Fehler" }), { type: "error" });
    }
  };

  const getSalesName = (salesId: number) => {
    const s = sales?.find((s) => s.id === salesId);
    return s ? `${s.first_name} ${s.last_name}` : `#${salesId}`;
  };

  const getRoleName = (rId: number) => {
    const r = roles?.find((r) => r.id === rId);
    return r?.name || `#${rId}`;
  };

  // Available (unassigned) users for the current role context
  const availableUsers = sales?.filter((s) => {
    const targetRole = roleId || (selectedRoleId ? parseInt(selectedRoleId) : null);
    if (!targetRole) return true;
    return !userRoles?.some((ur) => ur.sales_id === s.id && ur.role_id === targetRole);
  });

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" />
              {translate("crm.rbac.user_assignments", { _: "Benutzer-Zuweisungen" })}
            </CardTitle>
            <CardDescription>
              {translate("crm.rbac.user_assignments_desc", { _: "Weisen Sie Benutzer dieser Rolle zu" })}
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {translate("crm.rbac.assign_user", { _: "Zuweisen" })}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">
            {translate("ra.page.loading")}
          </div>
        ) : !userRoles?.length ? (
          <div className="text-center py-6 text-muted-foreground">
            <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{translate("crm.rbac.no_user_assignments", { _: "Keine Benutzer zugewiesen" })}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {userRoles.map((ur) => (
              <div
                key={ur.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{getSalesName(ur.sales_id)}</span>
                  {!roleId && (
                    <Badge variant="outline" className="text-xs">
                      <Shield className="h-3 w-3 mr-1" />
                      {getRoleName(ur.role_id)}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                  onClick={() => handleRemove(ur.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Assign Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {translate("crm.rbac.assign_user_dialog", { _: "Benutzer zu Rolle zuweisen" })}
            </DialogTitle>
            <DialogDescription>
              {translate("crm.rbac.assign_user_description", { _: "Wählen Sie einen Benutzer und eine Rolle aus, um die Zuordnung zu erstellen." })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!roleId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {translate("crm.rbac.role_label", { _: "Rolle" })}
                </label>
                <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder={translate("crm.rbac.select_role", { _: "Rolle wählen..." })} />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map((role) => (
                      <SelectItem key={role.id} value={role.id.toString()}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {translate("crm.rbac.user", { _: "Benutzer" })}
              </label>
              <Select value={selectedSalesId} onValueChange={setSelectedSalesId}>
                <SelectTrigger>
                  <SelectValue placeholder={translate("crm.rbac.select_user", { _: "Benutzer wählen..." })} />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers?.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.first_name} {s.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {translate("ra.action.cancel")}
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedSalesId || (!roleId && !selectedRoleId)}
            >
              {translate("crm.rbac.assign", { _: "Zuweisen" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default UserRoleAssignment;
