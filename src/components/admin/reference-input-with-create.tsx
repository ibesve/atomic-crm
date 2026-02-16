import { useState, useCallback } from "react";
import {
  useCreate,
  useGetList,
  useNotify,
  useTranslate,
  RaRecord,
} from "ra-core";
import { Plus, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FieldConfig {
  source: string;
  label: string;
  type?: "text" | "number" | "email" | "tel" | "select" | "textarea";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface ReferenceInputWithCreateProps {
  source: string;
  reference: string;
  label: string;
  optionText?: string | ((record: RaRecord) => string);
  value?: number | string | null;
  onChange: (value: number | string | null) => void;
  createFields: FieldConfig[];
  createTitle?: string;
  className?: string;
  allowCreate?: boolean;
}

export function ReferenceInputWithCreate({
  reference,
  label,
  optionText = "name",
  value,
  onChange,
  createFields,
  createTitle,
  className,
  allowCreate = true,
}: ReferenceInputWithCreateProps) {
  const translate = useTranslate();
  const notify = useNotify();
  const [create, { isPending: isCreating }] = useCreate();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRecord, setNewRecord] = useState<Record<string, any>>({});

  const { data: options, isPending: isLoadingOptions, refetch } = useGetList(reference, {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: typeof optionText === "string" ? optionText : "id", order: "ASC" },
  });

  const getOptionLabel = useCallback(
    (record: RaRecord) => {
      if (typeof optionText === "function") {
        return optionText(record);
      }
      return record[optionText] || record.id;
    },
    [optionText]
  );

  const handleCreateNew = useCallback(async () => {
    const missingFields = createFields
      .filter((f) => f.required && !newRecord[f.source])
      .map((f) => f.label);

    if (missingFields.length > 0) {
      notify(
        translate("ra.validation.required", {
          _: `Pflichtfelder fehlen: ${missingFields.join(", ")}`,
        }),
        { type: "error" }
      );
      return;
    }

    try {
      const result = await create(
        reference,
        { data: newRecord },
        { returnPromise: true }
      );

      if (result?.data?.id) {
        onChange(result.data.id);
        setShowCreateForm(false);
        setNewRecord({});
        refetch();
        notify(translate("ra.notification.created", { smart_count: 1 }), {
          type: "success",
        });
      }
    } catch (error: any) {
      notify(error.message || translate("ra.notification.http_error"), {
        type: "error",
      });
    }
  }, [newRecord, createFields, create, reference, onChange, refetch, notify, translate]);

  const handleFieldChange = useCallback((field: string, fieldValue: any) => {
    setNewRecord((prev) => ({ ...prev, [field]: fieldValue }));
  }, []);

  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      
      <div className="flex gap-2">
        <Select
          value={value?.toString() || ""}
          onValueChange={(v) => onChange(v ? parseInt(v) : null)}
          disabled={isLoadingOptions}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={translate("ra.action.select", { _: "Auswählen..." })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">-</SelectItem>
            {options?.map((option) => (
              <SelectItem key={option.id} value={option.id.toString()}>
                {getOptionLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {allowCreate && (
          <Button
            type="button"
            variant={showCreateForm ? "secondary" : "outline"}
            size="icon"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Nested Create Form */}
      {showCreateForm && (
        <Card className="p-4 mt-2 border-dashed">
          <div className="flex items-center justify-between cursor-pointer mb-3">
            <h4 className="text-sm font-medium">
              {createTitle || translate("ra.action.create", { _: "Neu erstellen" })}
            </h4>
            <ChevronDown className="h-4 w-4" />
          </div>
          <div className="space-y-3">
            {createFields.map((field) => (
              <div key={field.source} className="space-y-1">
                <Label className="text-xs">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {field.type === "select" && field.options ? (
                  <Select
                    value={newRecord[field.source]?.toString() || ""}
                    onValueChange={(v) => handleFieldChange(field.source, v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder={field.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === "textarea" ? (
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newRecord[field.source] || ""}
                    onChange={(e) => handleFieldChange(field.source, e.target.value)}
                    placeholder={field.placeholder}
                  />
                ) : (
                  <Input
                    type={field.type || "text"}
                    value={newRecord[field.source] || ""}
                    onChange={(e) =>
                      handleFieldChange(
                        field.source,
                        field.type === "number"
                          ? parseFloat(e.target.value)
                          : e.target.value
                      )
                    }
                    placeholder={field.placeholder}
                    className="h-8"
                  />
                )}
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewRecord({});
                }}
              >
                {translate("ra.action.cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCreateNew}
                disabled={isCreating}
              >
                {translate("ra.action.create")}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default ReferenceInputWithCreate;
