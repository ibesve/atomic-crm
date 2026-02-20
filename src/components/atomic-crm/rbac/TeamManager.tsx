import { useState } from "react";
import { useTranslate, useGetList, useDataProvider, useNotify } from "ra-core";
import { Plus, Trash2, UserPlus, Crown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Team, TeamMember } from "../types/rbac";

interface Sales {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

export const TeamManager = () => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedSalesId, setSelectedSalesId] = useState<string>("");

  const { data: teams, refetch: refetchTeams } = useGetList<Team>("teams", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "name", order: "ASC" },
  });

  const { data: teamMembers, refetch: refetchMembers } = useGetList<TeamMember & { sales: Sales }>(
    "team_members",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
    }
  );

  const { data: salesUsers } = useGetList<Sales>("sales", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "last_name", order: "ASC" },
  });

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    
    try {
      await dataProvider.create("teams", {
        data: {
          name: newTeamName,
          description: newTeamDescription || null,
        },
      });
      setNewTeamName("");
      setNewTeamDescription("");
      setCreateDialogOpen(false);
      refetchTeams();
      notify(translate("crm.rbac.team_created"), { type: "success" });
    } catch (error) {
      notify(translate("crm.rbac.error"), { type: "error" });
    }
  };

  const deleteTeam = async (teamId: number) => {
    try {
      await dataProvider.delete("teams", { id: teamId, previousData: { id: teamId } });
      refetchTeams();
      notify(translate("crm.rbac.team_deleted"), { type: "success" });
    } catch (error) {
      notify(translate("crm.rbac.error"), { type: "error" });
    }
  };

  const addMember = async () => {
    if (!selectedTeamId || !selectedSalesId) return;

    try {
      await dataProvider.create("team_members", {
        data: {
          team_id: selectedTeamId,
          sales_id: parseInt(selectedSalesId),
          is_leader: false,
        },
      });
      setAddMemberDialogOpen(false);
      setSelectedSalesId("");
      refetchMembers();
      notify(translate("crm.rbac.member_added"), { type: "success" });
    } catch (error) {
      notify(translate("crm.rbac.error"), { type: "error" });
    }
  };

  const removeMember = async (memberId: number) => {
    try {
      await dataProvider.delete("team_members", { id: memberId, previousData: { id: memberId } });
      refetchMembers();
      notify(translate("crm.rbac.member_removed"), { type: "success" });
    } catch (error) {
      notify(translate("crm.rbac.error"), { type: "error" });
    }
  };

  const toggleLeader = async (member: TeamMember) => {
    try {
      await dataProvider.update("team_members", {
        id: member.id,
        data: { is_leader: !member.is_leader },
        previousData: member,
      });
      refetchMembers();
    } catch (error) {
      notify(translate("crm.rbac.error"), { type: "error" });
    }
  };

  const getTeamMembers = (teamId: number) => {
    return teamMembers?.filter((m) => m.team_id === teamId) || [];
  };

  const getSalesName = (salesId: number) => {
    const sales = salesUsers?.find((s) => s.id === salesId);
    return sales ? `${sales.first_name} ${sales.last_name}` : "";
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{translate("crm.rbac.teams")}</h3>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              {translate("crm.rbac.new_team")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{translate("crm.rbac.create_team")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                placeholder={translate("crm.rbac.team_name")}
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
              <Input
                placeholder={translate("crm.rbac.description")}
                value={newTeamDescription}
                onChange={(e) => setNewTeamDescription(e.target.value)}
              />
              <Button onClick={createTeam} className="w-full">
                {translate("ra.action.create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams?.map((team) => (
          <Card key={team.id} className="p-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-semibold">{team.name}</h4>
                {team.description && (
                  <p className="text-sm text-muted-foreground">{team.description}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => deleteTeam(team.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {translate("crm.rbac.members")}
                </span>
                <Dialog open={addMemberDialogOpen && selectedTeamId === team.id} onOpenChange={(open) => {
                  setAddMemberDialogOpen(open);
                  if (open) setSelectedTeamId(team.id);
                }}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <UserPlus className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{translate("crm.rbac.add_member")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <Select value={selectedSalesId} onValueChange={setSelectedSalesId}>
                        <SelectTrigger>
                          <SelectValue placeholder={translate("crm.rbac.select_user")} />
                        </SelectTrigger>
                        <SelectContent>
                          {salesUsers?.map((sales) => (
                            <SelectItem key={sales.id} value={sales.id.toString()}>
                              {sales.first_name} {sales.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={addMember} className="w-full">
                        {translate("ra.action.add")}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-1">
                {getTeamMembers(team.id).map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{getSalesName(member.sales_id)}</span>
                      {member.is_leader && (
                        <Badge variant="secondary" className="text-xs">
                          <Crown className="w-3 h-3 mr-1" />
                          {translate("crm.rbac.leader")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleLeader(member)}
                        title={translate("crm.rbac.toggle_leader")}
                      >
                        <Crown className={`w-3 h-3 ${member.is_leader ? "text-yellow-500" : ""}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removeMember(member.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {getTeamMembers(team.id).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    {translate("crm.rbac.no_members")}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
