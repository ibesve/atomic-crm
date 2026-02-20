import { useState, useEffect, useCallback } from "react";
import { useTranslate, useDataProvider, useNotify } from "ra-core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Save } from "lucide-react";
import type { RolePermission, PermissionScope, ResourceType, ActionType } from "../types/rbac";

const RESOURCES: ResourceType[] = [
  'contacts',
  'companies', 
  'deals',
  'tasks',
  'contact_notes',
  'deal_notes',
  'sales',
  'roles',
  'teams',
];

const ACTIONS: ActionType[] = ['list', 'show', 'create', 'edit', 'delete'];

const SCOPES: PermissionScope[] = ['all', 'team', 'own', 'none'];

interface PermissionMatrix {
  [resource: string]: {
    [action: string]: PermissionScope;
  };
}

export const RolePermissionsEditor = ({ roleId }: { roleId: number }) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [permissions, setPermissions] = useState<PermissionMatrix>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await dataProvider.getList<RolePermission>('role_permissions', {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: 'id', order: 'ASC' },
        filter: { role_id: roleId },
      });

      const matrix: PermissionMatrix = {};
      RESOURCES.forEach(resource => {
        matrix[resource] = {};
        ACTIONS.forEach(action => {
          matrix[resource][action] = 'none';
        });
      });

      data.forEach(perm => {
        if (matrix[perm.resource]) {
          matrix[perm.resource][perm.action] = perm.scope;
        }
      });

      setPermissions(matrix);
    } catch {
      notify('crm.rbac.load_error', { type: 'error' });
    }
    setLoading(false);
  }, [dataProvider, roleId, notify]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const handleScopeChange = (resource: string, action: string, scope: PermissionScope) => {
    setPermissions(prev => ({
      ...prev,
      [resource]: {
        ...prev[resource],
        [action]: scope,
      },
    }));
  };

  const savePermissions = async () => {
    setSaving(true);
    try {
      // Delete all existing permissions for this role
      const { data: existing } = await dataProvider.getList<RolePermission>('role_permissions', {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: 'id', order: 'ASC' },
        filter: { role_id: roleId },
      });

      // Batch delete all existing permissions
      await Promise.all(
        existing.map((perm) =>
          dataProvider.delete('role_permissions', { id: perm.id, previousData: perm })
        )
      );

      // Collect all new permissions to create
      const permissionsToCreate: Array<{ role_id: number; resource: string; action: string; scope: string }> = [];
      for (const resource of RESOURCES) {
        for (const action of ACTIONS) {
          const scope = permissions[resource]?.[action];
          if (scope && scope !== 'none') {
            permissionsToCreate.push({ role_id: roleId, resource, action, scope });
          }
        }
      }

      // Batch create all new permissions
      await Promise.all(
        permissionsToCreate.map((data) =>
          dataProvider.create('role_permissions', { data })
        )
      );

      notify(translate('crm.rbac.saved'), { type: 'success' });
    } catch {
      notify(translate('crm.rbac.save_error'), { type: 'error' });
    }
    setSaving(false);
  };

  const getScopeLabel = (scope: PermissionScope) => {
    return translate(`crm.rbac.scope_${scope}`);
  };

  const getResourceLabel = (resource: string) => {
    return translate(`crm.rbac.resource_${resource}`);
  };

  const getActionLabel = (action: string) => {
    return translate(`crm.rbac.action_${action}`);
  };

  if (loading) {
    return <div className="p-4">{translate('ra.page.loading')}</div>;
  }

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{translate('crm.rbac.permissions')}</h3>
        <Button onClick={savePermissions} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {translate('ra.action.save')}
        </Button>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">{translate('crm.rbac.resource')}</TableHead>
              {ACTIONS.map(action => (
                <TableHead key={action} className="text-center">
                  {getActionLabel(action)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {RESOURCES.map(resource => (
              <TableRow key={resource}>
                <TableCell className="font-medium">
                  {getResourceLabel(resource)}
                </TableCell>
                {ACTIONS.map(action => (
                  <TableCell key={action} className="text-center">
                    <Select
                      value={permissions[resource]?.[action] || 'none'}
                      onValueChange={(value) => handleScopeChange(resource, action, value as PermissionScope)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCOPES.map(scope => (
                          <SelectItem key={scope} value={scope}>
                            {getScopeLabel(scope)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};
