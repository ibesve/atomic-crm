import { useState } from "react";
import { useTranslate } from "ra-core";
import {
  History,
  User,
  Clock,
  FileEdit,
  Trash2,
  Plus,
  RotateCcw,
  Download,
  Upload,
  GitMerge,
  ChevronDown,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuditLog } from "@/hooks/use-audit-log";
import type { AuditLog, AuditAction } from "@/hooks/use-audit-log";

interface AuditLogViewerProps {
  resourceType?: string;
  resourceId?: number;
  showFilters?: boolean;
  maxHeight?: string;
  className?: string;
}

const ACTION_ICONS: Record<AuditAction, React.ElementType> = {
  create: Plus,
  update: FileEdit,
  delete: Trash2,
  restore: RotateCcw,
  export: Download,
  import: Upload,
  merge: GitMerge,
  bulk_delete: Trash2,
  bulk_update: FileEdit,
};

const ACTION_COLORS: Record<AuditAction, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  delete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  restore: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  export: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  import: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  merge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  bulk_delete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  bulk_update: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

const ACTION_LABELS: Record<AuditAction, string> = {
  create: "Erstellt",
  update: "Aktualisiert",
  delete: "Gelöscht",
  restore: "Wiederhergestellt",
  export: "Exportiert",
  import: "Importiert",
  merge: "Zusammengeführt",
  bulk_delete: "Mehrfach gelöscht",
  bulk_update: "Mehrfach aktualisiert",
};

export function AuditLogViewer({
  resourceType,
  resourceId,
  showFilters = true,
  maxHeight = "600px",
  className,
}: AuditLogViewerProps) {
  const translate = useTranslate();
  const [actionFilter, setActionFilter] = useState<AuditAction | "all">("all");
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const { auditLogs, total, isPending } = useAuditLog({
    resourceType,
    resourceId,
    action: actionFilter === "all" ? undefined : actionFilter,
    limit: 200,
  });

  const toggleExpanded = (id: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Gerade eben";
    if (diffMins < 60) return `vor ${diffMins} Min.`;
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    if (diffDays < 7) return `vor ${diffDays} Tagen`;
    return formatDate(dateString);
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            {translate("crm.audit_log.title", { _: "Änderungsprotokoll" })}
            {total > 0 && (
              <Badge variant="secondary" className="ml-2">
                {total}
              </Badge>
            )}
          </CardTitle>

          {showFilters && (
            <Select
              value={actionFilter}
              onValueChange={(v) => setActionFilter(v as AuditAction | "all")}
            >
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Aktionen</SelectItem>
                <SelectItem value="create">Erstellt</SelectItem>
                <SelectItem value="update">Aktualisiert</SelectItem>
                <SelectItem value="delete">Gelöscht</SelectItem>
                <SelectItem value="restore">Wiederhergestellt</SelectItem>
                <SelectItem value="export">Exportiert</SelectItem>
                <SelectItem value="import">Importiert</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea style={{ maxHeight }} className="pr-4">
          {isPending ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Lade Protokoll...
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mb-2 opacity-50" />
              <p>Keine Einträge gefunden</p>
            </div>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <AuditLogEntry
                  key={log.id}
                  log={log}
                  isExpanded={expandedItems.has(log.id)}
                  onToggle={() => toggleExpanded(log.id)}
                  formatDate={formatDate}
                  formatRelativeTime={formatRelativeTime}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface AuditLogEntryProps {
  log: AuditLog;
  isExpanded: boolean;
  onToggle: () => void;
  formatDate: (date: string) => string;
  formatRelativeTime: (date: string) => string;
}

function AuditLogEntry({
  log,
  isExpanded,
  onToggle,
  formatDate,
  formatRelativeTime,
}: AuditLogEntryProps) {
  const ActionIcon = ACTION_ICONS[log.action] || FileEdit;
  const hasDetails = log.changed_fields?.length || log.old_values || log.new_values;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div
        className={cn(
          "border rounded-lg p-3 transition-colors",
          log.action === "delete" && "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"
        )}
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-start gap-3 cursor-pointer">
            <div
              className={cn(
                "p-2 rounded-full",
                ACTION_COLORS[log.action]
              )}
            >
              <ActionIcon className="h-4 w-4" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {ACTION_LABELS[log.action]}
                </Badge>
                <span className="text-sm font-medium truncate">
                  {log.resource_name || `${log.resource_type} #${log.resource_id}`}
                </span>
                {log.affected_count > 1 && (
                  <Badge variant="secondary" className="text-xs">
                    {log.affected_count} Einträge
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {log.user_name || log.user_email || "System"}
                </span>
                <span className="flex items-center gap-1" title={formatDate(log.created_at)}>
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(log.created_at)}
                </span>
              </div>

              {log.changed_fields && log.changed_fields.length > 0 && !isExpanded && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Geändert: {log.changed_fields.slice(0, 3).join(", ")}
                  {log.changed_fields.length > 3 && ` +${log.changed_fields.length - 3} weitere`}
                </div>
              )}
            </div>

            {hasDetails && (
              <Button variant="ghost" size="icon" className="h-6 w-6">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          {hasDetails && (
            <div className="mt-3 pt-3 border-t space-y-3">
              {log.changed_fields && log.changed_fields.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">
                    Geänderte Felder
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {log.changed_fields.map((field) => (
                      <Badge key={field} variant="outline" className="text-xs">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {(log.old_values || log.new_values) && (
                <div className="grid grid-cols-2 gap-4">
                  {log.old_values && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">
                        Alter Wert
                      </h4>
                      <ChangeValues 
                        values={log.old_values} 
                        changedFields={log.changed_fields || []} 
                      />
                    </div>
                  )}
                  {log.new_values && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">
                        Neuer Wert
                      </h4>
                      <ChangeValues 
                        values={log.new_values} 
                        changedFields={log.changed_fields || []} 
                      />
                    </div>
                  )}
                </div>
              )}

              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">
                    Zusätzliche Informationen
                  </h4>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface ChangeValuesProps {
  values: Record<string, unknown>;
  changedFields: string[];
}

function ChangeValues({ values, changedFields }: ChangeValuesProps) {
  // Zeige nur geänderte Felder oder alle wenn keine angegeben
  const fieldsToShow = changedFields.length > 0 
    ? changedFields.filter(f => f in values)
    : Object.keys(values).filter(k => !["id", "created_at", "updated_at"].includes(k));

  if (fieldsToShow.length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  return (
    <div className="space-y-1">
      {fieldsToShow.slice(0, 10).map((field) => (
        <div key={field} className="text-xs">
          <span className="font-medium">{field}:</span>{" "}
          <span className="text-muted-foreground">
            {formatValue(values[field])}
          </span>
        </div>
      ))}
      {fieldsToShow.length > 10 && (
        <div className="text-xs text-muted-foreground">
          +{fieldsToShow.length - 10} weitere Felder
        </div>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string" && value.length > 50) {
    return value.substring(0, 50) + "...";
  }
  return String(value);
}

export default AuditLogViewer;
