// Custom Objects und Custom Fields Typen

export type CustomFieldType = 
  | 'text' 
  | 'number' 
  | 'date' 
  | 'datetime' 
  | 'boolean' 
  | 'select' 
  | 'multiselect' 
  | 'reference' 
  | 'email' 
  | 'phone' 
  | 'url' 
  | 'textarea' 
  | 'currency' 
  | 'percent' 
  | 'rating';

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

export interface ValidationRules {
  min?: number;
  max?: number;
  min_length?: number;
  max_length?: number;
  pattern?: string;
  pattern_message?: string;
}

export interface CustomFieldDefinition {
  id: number;
  created_at: string;
  updated_at: string;
  custom_object_id: number | null;
  entity_type: 'contacts' | 'companies' | 'deals' | null;
  name: string;
  label: string;
  description: string | null;
  field_type: CustomFieldType;
  is_required: boolean;
  is_unique: boolean;
  default_value: string | null;
  options: SelectOption[] | null;
  reference_object: string | null;
  reference_display_field: string | null;
  validation_rules: ValidationRules | null;
  placeholder: string | null;
  help_text: string | null;
  show_in_list: boolean;
  show_in_detail: boolean;
  column_width: number | null;
  sort_order: number;
  field_group: string | null;
  deleted_at: string | null;
}

export interface CustomObjectDefinition {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  label: string;
  label_plural: string;
  description: string | null;
  icon: string;
  color: string;
  is_active: boolean;
  allow_attachments: boolean;
  allow_notes: boolean;
  allow_tasks: boolean;
  sort_order: number;
  deleted_at: string | null;
}

export interface CustomObjectWithFields extends CustomObjectDefinition {
  fields: CustomFieldDefinition[];
}

export interface CustomObjectData {
  id: number;
  created_at: string;
  updated_at: string;
  object_definition_id: number;
  data: Record<string, unknown>;
  sales_id: number | null;
  deleted_at: string | null;
}

export interface CustomFieldValue {
  id: number;
  created_at: string;
  updated_at: string;
  field_definition_id: number;
  contact_id: number | null;
  company_id: number | null;
  deal_id: number | null;
  value: unknown;
}

export interface ObjectRelationship {
  id: number;
  created_at: string;
  source_type: string;
  source_id: number;
  target_type: string;
  target_id: number;
  relationship_type: string | null;
  metadata: Record<string, unknown> | null;
}

export interface RelationshipDefinition {
  id: number;
  source_object_type: string;
  target_object_type: string;
  relationship_name: string;
  inverse_name: string | null;
  cardinality: "one-to-one" | "one-to-many" | "many-to-many";
  created_at: string;
}

// Formular-Typen für UI
export interface CustomObjectFormData {
  name: string;
  label: string;
  label_plural: string;
  description?: string;
  icon?: string;
  color?: string;
  is_active?: boolean;
  allow_attachments?: boolean;
  allow_notes?: boolean;
  allow_tasks?: boolean;
}

export interface CustomFieldFormData {
  name: string;
  label: string;
  description?: string;
  field_type: CustomFieldType;
  is_required?: boolean;
  is_unique?: boolean;
  default_value?: string;
  options?: SelectOption[];
  reference_object?: string;
  reference_display_field?: string;
  validation_rules?: ValidationRules;
  placeholder?: string;
  help_text?: string;
  show_in_list?: boolean;
  show_in_detail?: boolean;
  column_width?: number;
  field_group?: string;
}

// Icon-Mapping für Lucide
export const CUSTOM_OBJECT_ICONS = [
  'box', 'folder', 'file', 'database', 'archive', 'briefcase', 
  'building', 'car', 'clipboard', 'coffee', 'credit-card', 'flag',
  'gift', 'globe', 'heart', 'home', 'key', 'layers', 'link',
  'map', 'package', 'paperclip', 'phone', 'pie-chart', 'printer',
  'rocket', 'server', 'settings', 'shield', 'shopping-cart', 'star',
  'tag', 'target', 'tool', 'truck', 'user', 'users', 'zap'
] as const;

// Feldtyp-Labels für UI
export const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Text',
  number: 'Zahl',
  date: 'Datum',
  datetime: 'Datum & Zeit',
  boolean: 'Ja/Nein',
  select: 'Auswahl',
  multiselect: 'Mehrfachauswahl',
  reference: 'Verknüpfung',
  email: 'E-Mail',
  phone: 'Telefon',
  url: 'URL',
  textarea: 'Mehrzeiliger Text',
  currency: 'Währung',
  percent: 'Prozent',
  rating: 'Bewertung',
};

// Feldtyp-Icons
export const FIELD_TYPE_ICONS: Record<CustomFieldType, string> = {
  text: 'type',
  number: 'hash',
  date: 'calendar',
  datetime: 'clock',
  boolean: 'toggle-left',
  select: 'list',
  multiselect: 'check-square',
  reference: 'link',
  email: 'mail',
  phone: 'phone',
  url: 'globe',
  textarea: 'align-left',
  currency: 'dollar-sign',
  percent: 'percent',
  rating: 'star',
};
