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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const EMPTY_VALUE = "__none__";

interface EditableCellProps<RecordType extends RaRecord = RaRecord> {
  source: string;
  resource: string;
  children?: ReactNode;
  type?: "text" | "number" | "select" | "reference";
  options?: { value: string; label: string }[];
  referenceData?: RaRecord[];
  renderDisplay?: (value: any, record: RecordType) => ReactNode;
  className?: string;
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
}: EditableCellProps<RecordType>) {
  const record = useRecordContext<RecordType>();
  const [isEditing, setIsEditing] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [value, setValue] = useState<any>(null);
  const [originalValue, setOriginalValue] = useState<any>(null);
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
          data: { [source]: value },
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
          onError: (error: any) => {
            notify(error.message || translate("ra.notification.http_error"), {
              type: "error",
            });
          },
        }
      );
    } catch (error) {
      // Error handled in onError callback
    }
  }, [record, resource, source, value, originalValue, update, notify, translate, refresh]);

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
        const currentVal = getNestedValue(record, source);
        setValue(currentVal);
        setOriginalValue(currentVal);
        setIsEditing(true);
        // Bei Select/Reference sofort den Dropdown öffnen
        if (type === "select" || type === "reference") {
          setTimeout(() => setSelectOpen(true), 50);
        }
      }
    },
    [record, source, type]
  );

  const cancelEditing = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
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
        data: { [source]: parsedValue },
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
        onError: (error: any) => {
          notify(error.message || translate("ra.notification.http_error"), {
            type: "error",
          });
          setIsEditing(false);
        },
      }
    );
  }, [record, resource, source, originalValue, type, update, notify, translate, refresh]);

  if (!record) return null;

  const currentValue = getNestedValue(record, source);

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
              type={type}
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
                  cancelEditing(e as any);
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
      <div className="flex items-center justify-between">
        <span className="flex-1">
          {children ??
            (renderDisplay
              ? renderDisplay(currentValue, record)
              : currentValue ?? "-")}
        </span>
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
      </div>
    </TableCell>
  );
}

// Helper function to get nested values (e.g., "company.name")
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

export default EditableCell;
