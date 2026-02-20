import { useState } from "react";
import { useTranslate, useGetList, useGetIdentity, useCreate, useUpdate, useDelete, useNotify, useRefresh } from "ra-core";
import { 
  Shield, 
  Users, 
  Plus, 
  Settings, 
  ChevronRight, 
  History, 
  Trash2, 
  Pencil,
  Save,
  Box,
  Type
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { RolePermissionsEditor } from "../rbac/RolePermissionsEditor";
import { TeamManager } from "../rbac/TeamManager";
import { AuditLogViewer } from "../audit/AuditLogViewer";
import { CustomObjectsManager } from "../custom-objects/CustomObjectsManager";
import { CustomFieldsManager } from "../custom-objects/CustomFieldsManager";
import type { Role } from "../types/rbac";

export const AdminSettingsPage = () => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteConfirmRole, setDeleteConfirmRole] = useState<Role | null>(null);
  
  // Formular-State für neue/bearbeitete Rolle
  const [roleForm, setRoleForm] = useState({ name: "", description: "" });

  const { data: roles, isLoading } = useGetList<Role>("roles", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "name", order: "ASC" },
  });

  const [create] = useCreate();
  const [update] = useUpdate();
  const [deleteOne] = useDelete();

  // Custom Fields Tab State
  const [selectedEntityType, setSelectedEntityType] = useState<"contacts" | "companies" | "deals">("contacts");

  // Zugriffskontrolle
  if (!identity?.administrator) {
    return (
      <div className="p-8 text-center">
        <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {translate("crm.admin.access_denied", { _: "Zugriff verweigert" })}
        </h2>
        <p className="text-muted-foreground">
          {translate("crm.admin.admin_required", { _: "Diese Seite ist nur für Administratoren zugänglich." })}
        </p>
      </div>
    );
  }

  // Rolle erstellen
  const handleCreateRole = async () => {
    if (!roleForm.name.trim()) {
      notify("Bitte geben Sie einen Namen ein", { type: "error" });
      return;
    }
    
    try {
      await create("roles", { 
        data: { 
          name: roleForm.name.trim(), 
          description: roleForm.description.trim() || null 
        } 
      });
      notify("Rolle erstellt", { type: "success" });
      setIsCreateDialogOpen(false);
      setRoleForm({ name: "", description: "" });
      refresh();
    } catch (error: any) {
      notify(error.message || "Fehler beim Erstellen", { type: "error" });
    }
  };

  // Rolle bearbeiten
  const handleUpdateRole = async () => {
    if (!editingRole || !roleForm.name.trim()) {
      notify("Bitte geben Sie einen Namen ein", { type: "error" });
      return;
    }
    
    try {
      await update("roles", { 
        id: editingRole.id,
        data: { 
          name: roleForm.name.trim(), 
          description: roleForm.description.trim() || null 
        },
        previousData: editingRole
      });
      notify("Rolle aktualisiert", { type: "success" });
      setEditingRole(null);
      setRoleForm({ name: "", description: "" });
      refresh();
    } catch (error: any) {
      notify(error.message || "Fehler beim Aktualisieren", { type: "error" });
    }
  };

  // Rolle löschen
  const handleDeleteRole = async () => {
    if (!deleteConfirmRole) return;
    
    try {
      await deleteOne("roles", { id: deleteConfirmRole.id, previousData: deleteConfirmRole });
      notify("Rolle gelöscht", { type: "success" });
      if (selectedRoleId === deleteConfirmRole.id) {
        setSelectedRoleId(null);
      }
      setDeleteConfirmRole(null);
      refresh();
    } catch (error: any) {
      notify(error.message || "Fehler beim Löschen", { type: "error" });
    }
  };

  // Dialog zum Bearbeiten öffnen
  const openEditDialog = (role: Role, e: React.MouseEvent) => {
    e.stopPropagation();
    setRoleForm({ name: role.name, description: role.description || "" });
    setEditingRole(role);
  };

  // Dialog zum Löschen öffnen
  const openDeleteDialog = (role: Role, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmRole(role);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Settings className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {translate("crm.admin.title", { _: "Administration" })}
          </h1>
          <p className="text-muted-foreground">
            {translate("crm.admin.subtitle", { _: "Rollen, Teams und Systemeinstellungen verwalten" })}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="w-4 h-4" />
            {translate("crm.rbac.roles", { _: "Rollen & Berechtigungen" })}
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-2">
            <Users className="w-4 h-4" />
            {translate("crm.rbac.teams", { _: "Teams" })}
          </TabsTrigger>
          <TabsTrigger value="custom-objects" className="gap-2">
            <Box className="w-4 h-4" />
            {translate("crm.custom_objects.title", { _: "Custom Objects" })}
          </TabsTrigger>
          <TabsTrigger value="custom-fields" className="gap-2">
            <Type className="w-4 h-4" />
            {translate("crm.custom_fields.title", { _: "Custom Fields" })}
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <History className="w-4 h-4" />
            {translate("crm.audit_log.title", { _: "Änderungsprotokoll" })}
          </TabsTrigger>
        </TabsList>

        {/* Rollen Tab */}
        <TabsContent value="roles" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Rollenliste */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">
                    {translate("crm.rbac.roles", { _: "Rollen" })}
                  </CardTitle>
                  <Button 
                    size="sm" 
                    onClick={() => {
                      setRoleForm({ name: "", description: "" });
                      setIsCreateDialogOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Neu
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Lade...
                  </div>
                ) : roles?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Keine Rollen vorhanden</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {roles?.map((role) => (
                      <div
                        key={role.id}
                        onClick={() => setSelectedRoleId(role.id)}
                        className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedRoleId === role.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{role.name}</div>
                          {role.description && (
                            <div className={`text-sm truncate ${
                              selectedRoleId === role.id 
                                ? "text-primary-foreground/70" 
                                : "text-muted-foreground"
                            }`}>
                              {role.description}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 opacity-0 group-hover:opacity-100 ${
                              selectedRoleId === role.id 
                                ? "hover:bg-primary-foreground/20" 
                                : ""
                            }`}
                            onClick={(e) => openEditDialog(role, e)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 opacity-0 group-hover:opacity-100 ${
                              selectedRoleId === role.id 
                                ? "hover:bg-primary-foreground/20 text-red-200" 
                                : "text-red-500 hover:text-red-600"
                            }`}
                            onClick={(e) => openDeleteDialog(role, e)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Berechtigungseditor */}
            <div className="lg:col-span-2">
              {selectedRoleId ? (
                <RolePermissionsEditor roleId={selectedRoleId} />
              ) : (
                <Card className="h-full flex items-center justify-center min-h-[400px]">
                  <div className="text-center p-8">
                    <Settings className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {translate("crm.rbac.select_role", { _: "Wählen Sie eine Rolle aus, um Berechtigungen zu bearbeiten" })}
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Teams Tab */}
        <TabsContent value="teams">
          <TeamManager />
        </TabsContent>

        {/* Custom Objects Tab */}
        <TabsContent value="custom-objects">
          <CustomObjectsManager />
        </TabsContent>

        {/* Custom Fields Tab - für Standard-Entities */}
        <TabsContent value="custom-fields">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  {translate("crm.custom_fields.for_entities", { _: "Custom Fields für Standard-Objekte" })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Fügen Sie benutzerdefinierte Felder zu Kontakten, Unternehmen oder Deals hinzu.
                </p>
                <Tabs value={selectedEntityType} onValueChange={(v) => setSelectedEntityType(v as typeof selectedEntityType)}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="contacts">Kontakte</TabsTrigger>
                    <TabsTrigger value="companies">Unternehmen</TabsTrigger>
                    <TabsTrigger value="deals">Deals</TabsTrigger>
                  </TabsList>
                  <TabsContent value="contacts">
                    <CustomFieldsManager entityType="contacts" />
                  </TabsContent>
                  <TabsContent value="companies">
                    <CustomFieldsManager entityType="companies" />
                  </TabsContent>
                  <TabsContent value="deals">
                    <CustomFieldsManager entityType="deals" />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <AuditLogViewer 
            showFilters={true}
            maxHeight="calc(100vh - 300px)"
          />
        </TabsContent>
      </Tabs>

      {/* Dialog: Rolle erstellen */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Rolle erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie eine neue Rolle und weisen Sie ihr anschließend Berechtigungen zu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={roleForm.name}
                onChange={(e) => setRoleForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="z.B. Vertriebsmitarbeiter"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Beschreibung</label>
              <Textarea
                value={roleForm.description}
                onChange={(e) => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optionale Beschreibung der Rolle..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateRole}>
              <Save className="w-4 h-4 mr-2" />
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Rolle bearbeiten */}
      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rolle bearbeiten</DialogTitle>
            <DialogDescription>
              Ändern Sie den Namen und die Beschreibung der Rolle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={roleForm.name}
                onChange={(e) => setRoleForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="z.B. Vertriebsmitarbeiter"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Beschreibung</label>
              <Textarea
                value={roleForm.description}
                onChange={(e) => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optionale Beschreibung der Rolle..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRole(null)}>
              Abbrechen
            </Button>
            <Button onClick={handleUpdateRole}>
              <Save className="w-4 h-4 mr-2" />
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Rolle löschen */}
      <AlertDialog open={!!deleteConfirmRole} onOpenChange={(open) => !open && setDeleteConfirmRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rolle löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die Rolle "{deleteConfirmRole?.name}" wirklich löschen? 
              Alle zugewiesenen Berechtigungen werden ebenfalls entfernt.
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteRole}
              className="bg-red-600 hover:bg-red-700"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

AdminSettingsPage.path = "/admin/settings";

export default AdminSettingsPage;
