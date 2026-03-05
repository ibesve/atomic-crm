import { useState } from "react";
import {
  History,
  Clock,
  ChevronDown,
  ChevronRight,
  Loader2,
  User,
} from "lucide-react";
import {
  useRecordContext,
  useResourceContext,
  useTranslate,
} from "ra-core";
import { useGetRevisions, type RecordRevision } from "@react-admin/ra-core-ee";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface RecordTimelineProps {
  resource?: string;
  recordId?: number | string;
  className?: string;
  maxHeight?: string;
}

/**
 * Shadcn wrapper that shows the version history / revisions of a record.
 * Uses the EE useGetRevisions hook.
 */
export function RecordTimeline({
  resource: resourceProp,
  recordId: recordIdProp,
  className,
  maxHeight = "400px",
}: RecordTimelineProps) {
  const translate = useTranslate();
  const record = useRecordContext();
  const resourceFromContext = useResourceContext();
  const resource = resourceProp ?? resourceFromContext;
  const recordId = recordIdProp ?? record?.id;
  const [expandedRevisions, setExpandedRevisions] = useState<Set<string | number>>(new Set());

  const { data: revisions, isPending } = useGetRevisions(
    resource,
    { recordId },
    { enabled: !!recordId }
  );

  const toggleRevision = (id: string | number) => {
    setExpandedRevisions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          {translate("ra-history.revisions", { _: "Versionen" })}
          {revisions && revisions.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {revisions.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <ScrollArea style={{ maxHeight }} className="pr-4">
          {isPending ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              {translate("ra.page.loading", { _: "Laden..." })}
            </div>
          ) : !revisions || revisions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mb-2 opacity-50" />
              <p>{translate("ra-history.no_revisions", { _: "Keine Versionen vorhanden" })}</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

              <div className="space-y-4">
                {revisions.map((revision: RecordRevision, index: number) => (
                  <RevisionEntry
                    key={revision.id}
                    revision={revision}
                    isLatest={index === 0}
                    isExpanded={expandedRevisions.has(revision.id)}
                    onToggle={() => toggleRevision(revision.id)}
                    formatDate={formatDate}
                    translate={translate}
                  />
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function RevisionEntry({
  revision,
  isLatest,
  isExpanded,
  onToggle,
  formatDate,
  translate,
}: {
  revision: RecordRevision;
  isLatest: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  formatDate: (d: string) => string;
  translate: (key: string, options?: any) => string;
}) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="flex items-start gap-4 pl-2">
        {/* Timeline dot */}
        <div
          className={cn(
            "relative z-10 w-4 h-4 rounded-full border-2 mt-1",
            isLatest
              ? "bg-primary border-primary"
              : "bg-background border-muted-foreground/40"
          )}
        />

        <div className="flex-1 min-w-0">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto">
              <div className="flex items-center gap-2 text-left">
                <span className="font-medium text-sm">
                  {revision.message ||
                    translate("ra-history.revision_label", {
                      _: `Version`,
                    })}
                </span>
                {isLatest && (
                  <Badge variant="default" className="text-xs">
                    {translate("ra-history.latest", { _: "Aktuell" })}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Clock className="h-3 w-3" />
                {formatDate(revision.date)}
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="mt-2 p-3 rounded-md border bg-muted/30 text-sm">
              {revision.authorId && (
                <div className="flex items-center gap-1 text-muted-foreground mb-2">
                  <User className="h-3 w-3" />
                  <span>{String(revision.authorId)}</span>
                </div>
              )}
              {revision.data && (
                <pre className="text-xs overflow-auto max-h-60 whitespace-pre-wrap break-words">
                  {JSON.stringify(revision.data, null, 2)}
                </pre>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </div>
    </Collapsible>
  );
}
