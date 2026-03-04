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
  scope: PermissionScope;
  created_at: string;
  // ABAC: Verknüpfte Bedingungen
  conditions?: PermissionCondition[];
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

// =====================================================
// ABAC (Attribute-Based Access Control) Types
// =====================================================

export type ConditionOperator = 
  | '=' 
  | '!=' 
  | '>' 
  | '<' 
  | '>=' 
  | '<=' 
  | 'IN' 
  | 'NOT IN' 
  | 'LIKE' 
  | 'ILIKE' 
  | 'IS NULL' 
  | 'IS NOT NULL'
  | 'CONTAINS';

export type ConditionSourceType = 
  | 'user_attribute' 
  | 'role_attribute' 
  | 'static_value' 
  | 'current_user';

export type ConditionType = 
  | 'attribute_match' 
  | 'field_value' 
  | 'custom_expression';

export type LogicOperator = 'AND' | 'OR';

export type AttributeDataType = 'text' | 'number' | 'boolean' | 'date' | 'select';

export type AttributeAppliesTo = 'user' | 'role';

// Attribut-Definition (vordefinierte Attribute wie Region, Abteilung, etc.)
export interface AttributeDefinition {
  id: number;
  name: string;
  label: string;
  description: string | null;
  data_type: AttributeDataType;
  allowed_values: AttributeAllowedValue[] | null;
  is_system: boolean;
  applies_to: AttributeAppliesTo[];
  created_at: string;
}

export interface AttributeAllowedValue {
  value: string;
  label: string;
  color?: string;
}

// Benutzerattribut (z.B. User X hat Region = "DACH")
export interface UserAttribute {
  id: number;
  sales_id: number;
  attribute_name: string;
  attribute_value: string;
  created_at: string;
  updated_at: string;
}

// Rollenattribut (z.B. Rolle "Vertrieb DACH" hat Region = "DACH")
export interface RoleAttribute {
  id: number;
  role_id: number;
  attribute_name: string;
  attribute_value: string;
  created_at: string;
}

// Bedingung für eine Berechtigung
export interface PermissionCondition {
  id: number;
  role_permission_id: number;
  condition_type: ConditionType;
  target_field: string;
  operator: ConditionOperator;
  source_type: ConditionSourceType;
  source_attribute: string | null;
  static_values: string[] | null;
  logic_operator: LogicOperator;
  is_active: boolean;
  created_at: string;
}

// Benutzer mit allen Attributen (View)
export interface UserWithAttributes {
  sales_id: number;
  first_name: string;
  last_name: string;
  email: string;
  administrator: boolean;
  role_id: number | null;
  role_name: string | null;
  user_attributes: Record<string, string>;
  role_attributes: Record<string, string[]>;
}

// =====================================================
// Form Data Types für UI
// =====================================================

export interface AttributeDefinitionFormData {
  name: string;
  label: string;
  description?: string;
  data_type: AttributeDataType;
  allowed_values?: AttributeAllowedValue[];
  applies_to: AttributeAppliesTo[];
}

export interface UserAttributeFormData {
  sales_id: number;
  attribute_name: string;
  attribute_value: string;
}

export interface RoleAttributeFormData {
  role_id: number;
  attribute_name: string;
  attribute_value: string;
}

export interface PermissionConditionFormData {
  role_permission_id: number;
  condition_type: ConditionType;
  target_field: string;
  operator: ConditionOperator;
  source_type: ConditionSourceType;
  source_attribute?: string;
  static_values?: string[];
  logic_operator: LogicOperator;
  is_active?: boolean;
}

// =====================================================
// Konstanten für UI
// =====================================================

export const CONDITION_OPERATORS: Record<ConditionOperator, string> = {
  '=': 'Gleich',
  '!=': 'Ungleich',
  '>': 'Größer als',
  '<': 'Kleiner als',
  '>=': 'Größer oder gleich',
  '<=': 'Kleiner oder gleich',
  'IN': 'In Liste',
  'NOT IN': 'Nicht in Liste',
  'LIKE': 'Enthält (case-sensitive)',
  'ILIKE': 'Enthält',
  'IS NULL': 'Ist leer',
  'IS NOT NULL': 'Ist nicht leer',
  'CONTAINS': 'Enthält Wert',
};

export const SOURCE_TYPES: Record<ConditionSourceType, string> = {
  'user_attribute': 'Benutzerattribut',
  'role_attribute': 'Rollenattribut',
  'static_value': 'Fester Wert',
  'current_user': 'Aktueller Benutzer',
};

export const ATTRIBUTE_DATA_TYPES: Record<AttributeDataType, string> = {
  'text': 'Text',
  'number': 'Zahl',
  'boolean': 'Ja/Nein',
  'date': 'Datum',
  'select': 'Auswahl',
};

// Felder die für ABAC-Bedingungen verfügbar sind (pro Ressource)
export const RESOURCE_FIELDS: Record<ResourceType, { field: string; label: string; type: AttributeDataType }[]> = {
  contacts: [
    { field: 'sales_id', label: 'Besitzer', type: 'number' },
    { field: 'status', label: 'Status', type: 'select' },
    { field: 'gender', label: 'Geschlecht', type: 'select' },
    { field: 'company_id', label: 'Unternehmen', type: 'number' },
  ],
  companies: [
    { field: 'sales_id', label: 'Besitzer', type: 'number' },
    { field: 'sector', label: 'Branche', type: 'select' },
    { field: 'size', label: 'Größe', type: 'select' },
  ],
  deals: [
    { field: 'sales_id', label: 'Besitzer', type: 'number' },
    { field: 'stage', label: 'Stage', type: 'select' },
    { field: 'type', label: 'Typ', type: 'select' },
    { field: 'amount', label: 'Betrag', type: 'number' },
    { field: 'company_id', label: 'Unternehmen', type: 'number' },
  ],
  tasks: [
    { field: 'sales_id', label: 'Zugewiesen an', type: 'number' },
    { field: 'type', label: 'Typ', type: 'select' },
    { field: 'due_date', label: 'Fälligkeitsdatum', type: 'date' },
  ],
  contact_notes: [
    { field: 'sales_id', label: 'Ersteller', type: 'number' },
  ],
  deal_notes: [
    { field: 'sales_id', label: 'Ersteller', type: 'number' },
  ],
  sales: [
    { field: 'administrator', label: 'Administrator', type: 'boolean' },
    { field: 'disabled', label: 'Deaktiviert', type: 'boolean' },
  ],
  roles: [],
  teams: [],
};
