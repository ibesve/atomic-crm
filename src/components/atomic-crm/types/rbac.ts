// RBAC Types
export interface Role {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: number;
  role_id: number;
  resource: string;
  action: string;
  scope: 'all' | 'own' | 'team' | 'none';
  created_at: string;
}

export interface Team {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface TeamMember {
  id: number;
  team_id: number;
  sales_id: number;
  is_leader: boolean;
  created_at: string;
}

export type PermissionScope = 'all' | 'own' | 'team' | 'none';

export type ResourceType = 
  | 'contacts' 
  | 'companies' 
  | 'deals' 
  | 'tasks' 
  | 'contact_notes' 
  | 'deal_notes'
  | 'sales'
  | 'roles'
  | 'teams';

export type ActionType = 'list' | 'show' | 'create' | 'edit' | 'delete';

export interface UserPermissions {
  sales_id: number;
  first_name: string;
  last_name: string;
  administrator: boolean;
  role_name: string | null;
  resource: string;
  action: string;
  scope: PermissionScope;
}
