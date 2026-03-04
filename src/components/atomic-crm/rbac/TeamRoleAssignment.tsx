import { useState } from "react";
import {
  useGetList,
  useCreate,
  useDelete,
  useNotify,
  useRefresh,
  useTranslate,
} from "ra-core";
import { Plus, Trash2, Users, Shield } from "lucide-react";
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
import type { Role, Team } from "../types/rbac";

interface TeamRole {
  id: number;
  team_id: number;
  role_id: number;
  created_at: string;
}

interface TeamRoleAssignmentProps {
  /** Optional: restrict to a specific team */
  teamId?: number;
  className?: string;
}

export function TeamRoleAssignment({ teamId, className }: TeamRoleAssignmentProps) {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [create] = useCreate();
  const [deleteOne] = useDelete();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teamId?.toString() || "");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  const { data: teamRoles, isLoading } = useGetList<TeamRole>("team_roles", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "id", order: "ASC" },
    filter: teamId ? { team_id: teamId } : {},
  });

  const { data: roles } = useGetList<Role>("roles", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "name", order: "ASC" },
  });

  const { data: teams } = useGetList<Team>("teams", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "name", order: "ASC" },
  });

  const handleAssign = async () => {
    if (!selectedRoleId || (!teamId && !selectedTeamId)) return;

    const targetTeamId = teamId || parseInt(selectedTeamId);
    const targetRoleId = parseInt(selectedRoleId);

    // Check if already assigned
    const existing = teamRoles?.find(
      (tr) => tr.team_id === targetTeamId && tr.role_id === targetRoleId
    );
    if (existing) {
      notify(translate("crm.rbac.team_already_assigned", { _: "Team ist bereits zugewiesen" }), { type: "warning" });
      return;
    }

    try {
      await create("team_roles", {
        data: {
          team_id: targetTeamId,
          role_id: targetRoleId,
        },
      }, { returnPromise: true });
      notify(translate("crm.rbac.team_role_assigned", { _: "Team-Rolle zugewiesen" }), { type: "success" });
      setIsDialogOpen(false);
      setSelectedRoleId("");
      if (!teamId) setSelectedTeamId("");
      refresh();
    } catch {
      notify(translate("crm.rbac.error", { _: "Fehler" }), { type: "error" });
    }
  };

  const handleRemove = async (teamRoleId: number) => {
    try {
      await deleteOne("team_roles", {
        id: teamRoleId,
        previousData: { id: teamRoleId },
      }, { returnPromise: true });
      notify(translate("crm.rbac.team_role_removed", { _: "Team-Rolle entfernt" }), { type: "success" });
      refresh();
    } catch {
      notify(translate("crm.rbac.error", { _: "Fehler" }), { type: "error" });
    }
  };

  const getTeamName = (tId: number) => {
    const t = teams?.find((t) => t.id === tId);
    return t?.name || `#${tId}`;
  };

  const getRoleName = (rId: number) => {
    const r = roles?.find((r) => r.id === rId);
    return r?.name || `#${rId}`;
  };

  // Available (unassigned) roles for the current team context
  const availableRoles = roles?.filter((r) => {
    const targetTeam = teamId || (selectedTeamId ? parseInt(selectedTeamId) : null);
    if (!targetTeam) return true;
    return !teamRoles?.some((tr) => tr.role_id === r.id && tr.team_id === targetTeam);
  });

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              {translate("crm.rbac.team_role_assignments", { _: "Team-Rollen" })}
            </CardTitle>
            <CardDescription>
              {translate("crm.rbac.team_role_assignments_desc", { _: "Weisen Sie diesem Team Rollen zu" })}
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {translate("crm.rbac.assign_role", { _: "Rolle zuweisen" })}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">
            {translate("ra.page.loading")}
          </div>
        ) : !teamRoles?.length ? (
          <div className="text-center py-6 text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{translate("crm.rbac.no_team_roles", { _: "Keine Rollen zugewiesen" })}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {teamRoles.map((tr) => (
              <div
                key={tr.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted group"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Shield className="h-3 w-3" />
                    {getRoleName(tr.role_id)}
                  </Badge>
                  {!teamId && (
                    <Badge variant="secondary" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {getTeamName(tr.team_id)}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                  onClick={() => handleRemove(tr.id)}
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
              {translate("crm.rbac.assign_team_role_dialog", { _: "Rolle zu Team zuweisen" })}
            </DialogTitle>
            <DialogDescription>
              {translate("crm.rbac.assign_team_role_description", { _: "Wählen Sie ein Team und eine Rolle aus, um die Zuordnung zu erstellen." })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!teamId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {translate("crm.rbac.team_label", { _: "Team" })}
                </label>
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder={translate("crm.rbac.select_team", { _: "Team wählen..." })} />
                  </SelectTrigger>
                  <SelectContent>
                    {teams?.map((team) => (
                      <SelectItem key={team.id} value={team.id.toString()}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {translate("crm.rbac.role_label", { _: "Rolle" })}
              </label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder={translate("crm.rbac.select_role_label", { _: "Rolle wählen..." })} />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles?.map((role) => (
                    <SelectItem key={role.id} value={role.id.toString()}>
                      {role.name}
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
              disabled={!selectedRoleId || (!teamId && !selectedTeamId)}
            >
              {translate("crm.rbac.assign", { _: "Zuweisen" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default TeamRoleAssignment;
