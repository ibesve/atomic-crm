import { useState } from "react";
import { useTranslate, useGetList, useGetIdentity } from "ra-core";
import { Link } from "react-router";
import { Shield, Users, Plus, Settings, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RolePermissionsEditor } from "./RolePermissionsEditor";
import { TeamManager } from "./TeamManager";
import type { Role } from "../types/rbac";

export const RBACAdminPage = () => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);

  const { data: roles, isLoading } = useGetList<Role>("roles", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "name", order: "ASC" },
  });

  if (!identity?.administrator) {
    return (
      <div className="p-8 text-center">
        <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {translate("crm.rbac.access_denied")}
        </h2>
        <p className="text-muted-foreground">
          {translate("crm.rbac.admin_required")}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{translate("crm.rbac.title")}</h1>
          <p className="text-muted-foreground">
            {translate("crm.rbac.subtitle")}
          </p>
        </div>
      </div>

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="w-4 h-4" />
            {translate("crm.rbac.roles")}
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-2">
            <Users className="w-4 h-4" />
            {translate("crm.rbac.teams")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Rollenliste */}
            <Card className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">{translate("crm.rbac.roles")}</h3>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/roles/create">
                    <Plus className="w-4 h-4 mr-1" />
                    {translate("crm.rbac.new_role")}
                  </Link>
                </Button>
              </div>

              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  {translate("ra.page.loading")}
                </div>
              ) : (
                <div className="space-y-2">
                  {roles?.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRoleId(role.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                        selectedRoleId === role.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div>
                        <div className="font-medium">{role.name}</div>
                        {role.description && (
                          <div className={`text-sm ${
                            selectedRoleId === role.id 
                              ? "text-primary-foreground/70" 
                              : "text-muted-foreground"
                          }`}>
                            {role.description}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Berechtigungseditor */}
            <div className="lg:col-span-2">
              {selectedRoleId ? (
                <RolePermissionsEditor roleId={selectedRoleId} />
              ) : (
                <Card className="p-8 text-center">
                  <Settings className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {translate("crm.rbac.select_role")}
                  </p>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="teams">
          <TeamManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

RBACAdminPage.path = "/admin/rbac";
