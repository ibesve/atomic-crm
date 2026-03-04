import { useGetList } from "ra-core";
import { TextInput } from "@/components/admin/text-input";
import { SelectInput } from "@/components/admin/select-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { DateInput } from "@/components/admin/date-input";
import type { CustomFieldDefinition } from "../types/custom-objects";

interface CustomFieldsSectionProps {
  entityType: "contacts" | "companies" | "deals";
  title?: string;
}

/**
 * A form section that renders all custom fields for a given entity type.
 * Used in create and edit forms to display custom field inputs.
 * 
 * Note: These fields use a `_cf_` prefix source that must be handled
 * by a form transform to save values to the custom_field_values table.
 */
export const CustomFieldsSection = ({
  entityType,
  title = "Zusatzfelder",
}: CustomFieldsSectionProps) => {
  const { data: fieldDefs, isLoading } = useGetList<CustomFieldDefinition>(
    "custom_field_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "sort_order", order: "ASC" },
      filter: {
        entity_type: entityType,
        "custom_object_id@is": "null",
        "deleted_at@is": "null",
      },
    },
  );

  if (isLoading || !fieldDefs || fieldDefs.length === 0) {
    return null;
  }

  // Group fields by field_group
  const grouped = fieldDefs.reduce(
    (acc, field) => {
      const group = field.field_group || "";
      if (!acc[group]) acc[group] = [];
      acc[group].push(field);
      return acc;
    },
    {} as Record<string, CustomFieldDefinition[]>,
  );

  return (
    <div className="flex flex-col gap-4 mt-4">
      <h6 className="text-lg font-semibold">{title}</h6>
      {Object.entries(grouped).map(([group, fields]) => (
        <div key={group} className="flex flex-col gap-4">
          {group && (
            <p className="text-sm font-medium text-muted-foreground">{group}</p>
          )}
          {fields.map((field) => (
            <CustomFieldInput key={field.id} field={field} />
          ))}
        </div>
      ))}
    </div>
  );
};

const CustomFieldInput = ({ field }: { field: CustomFieldDefinition }) => {
  const source = `_cf_${field.name}`;

  switch (field.field_type) {
    case "text":
    case "email":
    case "phone":
    case "url":
      return (
        <TextInput
          source={source}
          label={field.label}
          helperText={field.help_text || false}
          placeholder={field.placeholder || undefined}
          type={field.field_type === "email" ? "email" : field.field_type === "url" ? "url" : "text"}
        />
      );
    case "textarea":
      return (
        <TextInput
          source={source}
          label={field.label}
          helperText={field.help_text || false}
          placeholder={field.placeholder || undefined}
          multiline
        />
      );
    case "number":
    case "currency":
    case "percent":
    case "rating":
      return (
        <TextInput
          source={source}
          label={field.label}
          helperText={field.help_text || false}
          placeholder={field.placeholder || undefined}
          type="number"
        />
      );
    case "boolean":
      return (
        <BooleanInput
          source={source}
          label={field.label}
          helperText={field.help_text || false}
        />
      );
    case "date":
    case "datetime":
      return (
        <DateInput
          source={source}
          label={field.label}
          helperText={field.help_text || false}
        />
      );
    case "select":
      return (
        <SelectInput
          source={source}
          label={field.label}
          helperText={field.help_text || false}
          choices={
            field.options?.map((o) => ({ id: o.value, name: o.label })) || []
          }
        />
      );
    case "multiselect":
      return (
        <SelectInput
          source={source}
          label={field.label}
          helperText={field.help_text || false}
          choices={
            field.options?.map((o) => ({ id: o.value, name: o.label })) || []
          }
        />
      );
    default:
      return (
        <TextInput
          source={source}
          label={field.label}
          helperText={field.help_text || false}
        />
      );
  }
};

export default CustomFieldsSection;
