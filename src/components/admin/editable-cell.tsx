import { useState, useCallback, ReactNode, useEffect, useRef } from "react";
import {
  useRecordContext,
  useUpdate,
  useNotify,
  useRefresh,
  useTranslate,
  RaRecord,
} from "ra-core";
import { X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell } from "@/components/ui/table";
import { cn, getNestedValue } from "@/lib/utils";

const EMPTY_VALUE = "__none__";

interface EditableCellProps<RecordType extends RaRecord = RaRecord> {
  source: string;
  resource: string;
  children?: ReactNode;
  type?: "text" | "number" | "select" | "reference" | "boolean" | "date" | "datetime";
  options?: { value: string; label: string }[];
  referenceData?: RaRecord[];
  renderDisplay?: (value: unknown, record: RecordType) => ReactNode;
  className?: string;
  /** Transform the edited value before saving */
  transformValue?: (value: unknown, record: RecordType) => Record<string, unknown>;
  /** Extract the editable value from the record for the input field */
  getEditValue?: (record: RecordType) => unknown;
}

export function EditableCell<RecordType extends RaRecord = RaRecord>({
  source,
  resource,
  children,
  type = "text",
  options,
  referenceData,
  renderDisplay,
  className,
  transformValue,
  getEditValue,
}: EditableCellProps<RecordType>) {
  const record = useRecordContext<RecordType>();
  const [isEditing, setIsEditing] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [value, setValue] = useState<unknown>(null);
  const [originalValue, setOriginalValue] = useState<unknown>(null);
  const [update, { isPending }] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();
  const translate = useTranslate();
  const cellRef = useRef<HTMLTableCellElement>(null);

  const saveChanges = useCallback(async () => {
    if (!record || value === originalValue) {
      setIsEditing(false);
      return;
    }

    try {
      await update(
        resource,
        {
          id: record.id,
          data: transformValue ? transformValue(value, record) : { [source]: value },
          previousData: record,
        },
        {
          onSuccess: () => {
            notify(translate("ra.notification.updated", { smart_count: 1 }), {
              type: "success",
            });
            setIsEditing(false);
            refresh();
          },
          onError: (err: Error) => {
            notify(err.message || translate("ra.notification.http_error"), {
              type: "error",
            });
          },
        }
      );
    } catch {
      // Error handled in onError callback
    }
  }, [record, resource, source, value, originalValue, update, notify, translate, refresh, transformValue]);

  // Click-Outside-Handler: Speichert automatisch beim Klick außerhalb
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Nicht schließen wenn der Select-Dropdown offen ist
      if (selectOpen) return;
      
      if (cellRef.current && !cellRef.current.contains(event.target as Node)) {
        saveChanges();
      }
    };

    // Verzögert hinzufügen, damit der initiale Klick nicht abgefangen wird
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditing, saveChanges, selectOpen]);

  const startEditing = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (record) {
        const currentVal = getEditValue ? getEditValue(record) : getNestedValue(record, source);
        setValue(currentVal);
        setOriginalValue(currentVal);
        setIsEditing(true);
        // Bei Select/Reference sofort den Dropdown öffnen
        if (type === "select" || type === "reference") {
          setTimeout(() => setSelectOpen(true), 50);
        }
      }
    },
    [record, source, type, getEditValue]
  );

  const cancelEditing = useCallback((e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    setIsEditing(false);
    setSelectOpen(false);
    setValue(originalValue);
  }, [originalValue]);

  // Handler für Select-Änderungen - speichert sofort
  const handleSelectChange = useCallback((newValue: string) => {
    const parsedValue = newValue === EMPTY_VALUE ? null : 
      (type === "reference" ? parseInt(newValue) : newValue);
    setValue(parsedValue);
    setSelectOpen(false);
    
    // Sofort speichern nach Auswahl
    if (!record || parsedValue === originalValue) {
      setIsEditing(false);
      return;
    }

    update(
      resource,
      {
        id: record.id,
        data: transformValue ? transformValue(parsedValue, record) : { [source]: parsedValue },
        previousData: record,
      },
      {
        onSuccess: () => {
          notify(translate("ra.notification.updated", { smart_count: 1 }), {
            type: "success",
          });
          setIsEditing(false);
          refresh();
        },
        onError: (err: Error) => {
          notify(err.message || translate("ra.notification.http_error"), {
            type: "error",
          });
          setIsEditing(false);
        },
      }
    );
  }, [record, resource, source, originalValue, type, update, notify, translate, refresh, transformValue]);

  if (!record) return null;

  const currentValue = getNestedValue(record, source);

  // Boolean fields render as a Switch (no edit mode needed — toggle saves immediately)
  if (type === "boolean") {
    const boolVal = Boolean(
      getEditValue ? getEditValue(record) : currentValue,
    );
    return (
      <TableCell
        className={cn("py-1", className)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <Switch
            checked={boolVal}
            disabled={isPending}
            onCheckedChange={(checked) => {
              if (!record) return;
              update(
                resource,
                {
                  id: record.id,
                  data: transformValue
                    ? transformValue(checked, record)
                    : { [source]: checked },
                  previousData: record,
                },
                {
                  onSuccess: () => {
                    notify(
                      translate("ra.notification.updated", { smart_count: 1 }),
                      { type: "success" },
                    );
                    refresh();
                  },
                  onError: (err: Error) => {
                    notify(
                      err.message ||
                        translate("ra.notification.http_error"),
                      { type: "error" },
                    );
                  },
                },
              );
            }}
          />
          <span className="text-xs text-muted-foreground">
            {boolVal ? "Ja" : "Nein"}
          </span>
        </div>
      </TableCell>
    );
  }

  if (isEditing) {
    return (
      <TableCell 
        ref={cellRef}
        className={cn("py-1", className)} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          {type === "select" && options ? (
            <Select 
              open={selectOpen}
              onOpenChange={setSelectOpen}
              value={value?.toString() || EMPTY_VALUE} 
              onValueChange={handleSelectChange}
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_VALUE}>-</SelectItem>
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : type === "reference" && referenceData ? (
            <Select
              open={selectOpen}
              onOpenChange={setSelectOpen}
              value={value?.toString() || EMPTY_VALUE}
              onValueChange={handleSelectChange}
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_VALUE}>-</SelectItem>
                {referenceData.map((item) => (
                  <SelectItem key={item.id} value={item.id.toString()}>
                    {item.name || (item.first_name
                      ? `${item.first_name} ${item.last_name}`
                      : item.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type={type === "datetime" ? "datetime-local" : type}
              value={value ?? ""}
              onChange={(e) =>
                setValue(type === "number" ? parseFloat(e.target.value) : e.target.value)
              }
              className="h-8"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveChanges();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEditing(e);
                }
              }}
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={cancelEditing}
            disabled={isPending}
            title={translate("ra.action.cancel")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    );
  }

  return (
    <TableCell 
      className={cn("py-1 group cursor-pointer hover:bg-muted/50", className)}
      onClick={startEditing}
    >
      <div className="flex items-center justify-between min-w-0">
        <span className="flex-1 truncate">
          {children ??
            (renderDisplay
              ? renderDisplay(currentValue, record)
              : currentValue ?? "-")}
        </span>
        <Pencil className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
      </div>
    </TableCell>
  );
}

export default EditableCell;
