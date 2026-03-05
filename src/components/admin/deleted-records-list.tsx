import { useState } from "react";
import { Trash2, RotateCcw, Loader2 } from "lucide-react";
import {
  useTranslate,
  useResourceContext,
  useListContext,
} from "ra-core";
import { useGetListDeleted } from "@react-admin/ra-core-ee";
import type { DeletedRecordType } from "@react-admin/ra-core-ee";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RestoreButton } from "./restore-button";

export interface DeletedRecordsListProps {
  className?: string;
  maxHeight?: string;
}

/**
 * Shadcn wrapper for the EE DeletedRecordsListBase.
 * Displays a list of soft-deleted records with restore/hard-delete actions.
 */
export function DeletedRecordsList({
  className,
  maxHeight = "calc(100vh - 300px)",
}: DeletedRecordsListProps) {
  const translate = useTranslate();
  const [resourceFilter, setResourceFilter] = useState<string>("all");

  const { data, total, isPending } = useGetListDeleted({
    filter: resourceFilter !== "all" ? { resource: resourceFilter } : undefined,
    sort: { field: "deleted_at", order: "DESC" },
    pagination: { page: 1, perPage: 100 },
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const getRecordLabel = (record: DeletedRecordType) => {
    const d = record.data;
    if (d.first_name || d.last_name) return `${d.first_name ?? ""} ${d.last_name ?? ""}`.trim();
    if (d.name) return d.name;
    return `#${d.id}`;
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trash2 className="h-5 w-5" />
            {translate("ra-soft-delete.deleted_records", { _: "Gelöschte Einträge" })}
            {(total ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-2">
                {total}
              </Badge>
            )}
          </CardTitle>
          <Select
            value={resourceFilter}
            onValueChange={setResourceFilter}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{translate("ra.action.all", { _: "Alle" })}</SelectItem>
              <SelectItem value="contacts">{translate("resources.contacts.name", { smart_count: 2, _: "Kontakte" })}</SelectItem>
              <SelectItem value="companies">{translate("resources.companies.name", { smart_count: 2, _: "Unternehmen" })}</SelectItem>
              <SelectItem value="deals">{translate("resources.deals.name", { smart_count: 2, _: "Deals" })}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea style={{ maxHeight }} className="pr-4">
          {isPending ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              {translate("ra.page.loading", { _: "Laden..." })}
            </div>
          ) : !data || data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Trash2 className="h-12 w-12 mb-2 opacity-50" />
              <p>{translate("ra-soft-delete.no_deleted_records", { _: "Keine gelöschten Einträge" })}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.map((record: DeletedRecordType) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {record.resource}
                      </Badge>
                      <span className="font-medium truncate">
                        {getRecordLabel(record)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {translate("ra-soft-delete.deleted_at", { _: "Gelöscht am" })}{" "}
                      {formatDate(record.deleted_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <RestoreButton
                      size="sm"
                      variant="ghost"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
