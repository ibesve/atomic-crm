import { useState, useCallback, useEffect } from "react";
import {
  useCreate,
  useGetList,
  useNotify,
  useTranslate,
  RaRecord,
} from "ra-core";
import { Plus, X, ChevronDown, Loader2, Check } from "lucide-react";
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

const EMPTY_VALUE = "__none__";

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
  const [create] = useCreate();
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRecord, setNewRecord] = useState<Record<string, any>>({});
  const [justCreatedId, setJustCreatedId] = useState<number | null>(null);
  
  // Lokaler State für den ausgewählten Wert - überschreibt den Parent-Wert wenn nötig
  const [localValue, setLocalValue] = useState<number | string | null>(value ?? null);

  // Synchronisiere lokalen State mit Parent-Wert, aber nicht wenn wir gerade etwas erstellt haben
  useEffect(() => {
    if (value !== undefined && value !== null && !justCreatedId) {
      setLocalValue(value);
    }
  }, [value, justCreatedId]);

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
        `Pflichtfelder fehlen: ${missingFields.join(", ")}`,
        { type: "error" }
      );
      return;
    }

    setIsCreating(true);
    
    create(
      reference,
      { data: newRecord },
      {
        onSuccess: (data) => {
          console.log("Created record:", data);
          const newId = data?.id;
          if (newId) {
            // Setze lokalen State sofort
            setLocalValue(newId);
            setJustCreatedId(newId);
            
            // Schließe das Formular
            setShowCreateForm(false);
            setNewRecord({});
            
            // Lade die Liste neu und setze dann den Parent-Wert
            refetch().then(() => {
              // Mehrfach onChange aufrufen um sicherzustellen dass es ankommt
              onChange(newId);
              // Nochmal nach kurzer Verzögerung
              setTimeout(() => {
                onChange(newId);
              }, 100);
            });
            
            // Setze Parent-Wert sofort
            onChange(newId);
            
            notify(`${label} erfolgreich erstellt und ausgewählt`, {
              type: "success",
            });
          }
          setIsCreating(false);
        },
        onError: (error: any) => {
          console.error("Create error:", error);
          notify(error.message || translate("ra.notification.http_error"), {
            type: "error",
          });
          setIsCreating(false);
        },
      }
    );
  }, [newRecord, createFields, create, reference, onChange, refetch, notify, translate, label]);

  const handleFieldChange = useCallback((field: string, fieldValue: any) => {
    setNewRecord((prev) => ({ ...prev, [field]: fieldValue }));
  }, []);

  const handleSelectChange = useCallback((v: string) => {
    const newValue = v === EMPTY_VALUE ? null : parseInt(v);
    setLocalValue(newValue);
    setJustCreatedId(null);
    onChange(newValue);
  }, [onChange]);

  // Verwende lokalen Wert für die Anzeige
  const displayValue = localValue ?? justCreatedId;

  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      
      <div className="flex gap-2">
        <Select
          value={displayValue?.toString() || EMPTY_VALUE}
          onValueChange={handleSelectChange}
          disabled={isLoadingOptions}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={translate("ra.action.select", { _: "Auswählen..." })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_VALUE}>-</SelectItem>
            {options?.map((option) => (
              <SelectItem key={option.id} value={option.id.toString()}>
                <span className="flex items-center gap-2">
                  {getOptionLabel(option)}
                  {option.id === justCreatedId && (
                    <Check className="h-3 w-3 text-green-500" />
                  )}
                </span>
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

      {/* Erfolgsanzeige */}
      {justCreatedId && !showCreateForm && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <Check className="h-3 w-3" />
          Neu erstellt und ausgewählt
        </p>
      )}

      {/* Nested Create Form */}
      {showCreateForm && (
        <Card className="p-4 mt-2 border-dashed border-2 border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between mb-3">
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
                    value={newRecord[field.source]?.toString() || EMPTY_VALUE}
                    onValueChange={(v) => handleFieldChange(field.source, v === EMPTY_VALUE ? null : v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder={field.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_VALUE}>-</SelectItem>
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

            <div className="flex justify-end gap-2 pt-2 border-t mt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewRecord({});
                }}
                disabled={isCreating}
              >
                {translate("ra.action.cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCreateNew}
                disabled={isCreating}
              >
                {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isCreating ? "Erstelle..." : "Erstellen & Auswählen"}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default ReferenceInputWithCreate;
