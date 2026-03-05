import { useTranslate } from "ra-core";
import { ArrowRight, Minus, Plus, Equal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface DiffViewerProps {
  oldData: Record<string, unknown>;
  newData: Record<string, unknown>;
  className?: string;
  /** Fields to exclude from diffing */
  excludeFields?: string[];
}

type ChangeType = "added" | "removed" | "changed" | "unchanged";

interface FieldDiff {
  field: string;
  type: ChangeType;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Shadcn-styled diff viewer that compares two records and highlights changes.
 * Used in revisions panel and audit log detail views.
 */
export function DiffViewer({
  oldData,
  newData,
  className,
  excludeFields = ["id", "created_at", "updated_at", "last_seen"],
}: DiffViewerProps) {
  const translate = useTranslate();
  const excludeSet = new Set(excludeFields);

  const allKeys = new Set([
    ...Object.keys(oldData),
    ...Object.keys(newData),
  ]);

  const diffs: FieldDiff[] = [];
  for (const field of allKeys) {
    if (excludeSet.has(field)) continue;

    const inOld = field in oldData;
    const inNew = field in newData;
    const oldVal = oldData[field];
    const newVal = newData[field];

    if (!inOld && inNew) {
      diffs.push({ field, type: "added", newValue: newVal });
    } else if (inOld && !inNew) {
      diffs.push({ field, type: "removed", oldValue: oldVal });
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs.push({ field, type: "changed", oldValue: oldVal, newValue: newVal });
    }
    // Skip unchanged
  }

  if (diffs.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground py-4 text-center", className)}>
        <Equal className="h-5 w-5 mx-auto mb-1 opacity-50" />
        {translate("ra-history.no_changes", { _: "Keine Änderungen" })}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {diffs.map((diff) => (
        <DiffRow key={diff.field} diff={diff} />
      ))}
    </div>
  );
}

function DiffRow({ diff }: { diff: FieldDiff }) {
  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return "null";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  return (
    <div
      className={cn(
        "flex items-start gap-2 p-2 rounded-md text-sm font-mono",
        diff.type === "added" && "bg-green-50 dark:bg-green-950/30",
        diff.type === "removed" && "bg-red-50 dark:bg-red-950/30",
        diff.type === "changed" && "bg-blue-50 dark:bg-blue-950/30"
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        {diff.type === "added" && <Plus className="h-3.5 w-3.5 text-green-600" />}
        {diff.type === "removed" && <Minus className="h-3.5 w-3.5 text-red-600" />}
        {diff.type === "changed" && <ArrowRight className="h-3.5 w-3.5 text-blue-600" />}
      </div>

      <div className="flex-1 min-w-0">
        <Badge variant="outline" className="text-xs mb-1">
          {diff.field}
        </Badge>

        {diff.type === "added" && (
          <div className="text-green-700 dark:text-green-400 break-all">
            {formatValue(diff.newValue)}
          </div>
        )}
        {diff.type === "removed" && (
          <div className="text-red-700 dark:text-red-400 line-through break-all">
            {formatValue(diff.oldValue)}
          </div>
        )}
        {diff.type === "changed" && (
          <div className="space-y-0.5">
            <div className="text-red-600 dark:text-red-400 line-through break-all">
              {formatValue(diff.oldValue)}
            </div>
            <div className="text-green-700 dark:text-green-400 break-all">
              {formatValue(diff.newValue)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
