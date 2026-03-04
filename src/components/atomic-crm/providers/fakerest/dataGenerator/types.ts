import type {
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  Sale,
  Tag,
  Task,
} from "../../../types";
import type { ConfigurationContextValue } from "../../../root/ConfigurationContext";

export interface Db {
  companies: Required<Company>[];
  contacts: Required<Contact>[];
  contact_notes: ContactNote[];
  deals: Deal[];
  deal_notes: DealNote[];
  sales: Sale[];
  tags: Tag[];
  tasks: Task[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
  // RBAC
  roles: Array<Record<string, unknown>>;
  role_permissions: Array<Record<string, unknown>>;
  teams: Array<Record<string, unknown>>;
  team_members: Array<Record<string, unknown>>;
  user_roles: Array<Record<string, unknown>>;
  team_roles: Array<Record<string, unknown>>;
  // ABAC
  attribute_definitions: Array<Record<string, unknown>>;
  user_attributes: Array<Record<string, unknown>>;
  permission_conditions: Array<Record<string, unknown>>;
  // Custom Objects
  custom_object_definitions: Array<Record<string, unknown>>;
  custom_field_definitions: Array<Record<string, unknown>>;
  custom_field_values: Array<Record<string, unknown>>;
  custom_object_data: Array<Record<string, unknown>>;
  object_relationships: Array<Record<string, unknown>>;
  relationship_definitions: Array<Record<string, unknown>>;
  // Audit
  audit_logs: Array<Record<string, unknown>>;
  record_versions: Array<Record<string, unknown>>;
}
