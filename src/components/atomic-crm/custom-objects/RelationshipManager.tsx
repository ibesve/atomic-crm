import { useState, useMemo, useCallback } from "react";
import {
  useGetList,
  useCreate,
  useDelete,
  useNotify,
  useRefresh,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, Trash2, ChevronDown, Link as LinkIcon } from "lucide-react";
import type {
  ObjectRelationship,
  RelationshipDefinition,
  CustomObjectDefinition,
} from "../types/custom-objects";

interface RelationshipManagerProps {
  /** The entity type, e.g. "contacts", "companies", "custom_event" */
  sourceType: string;
  /** The record ID */
  sourceId: number;
  /** Optional label override */
  title?: string;
}

/**
 * Displays and manages relationships for a given entity instance.
 * Shows related objects grouped by relationship type, with the ability
 * to add new links and navigate transitively.
 */
export const RelationshipManager = ({
  sourceType,
  sourceId,
  title = "Verknüpfungen",
}: RelationshipManagerProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedRelDef, setSelectedRelDef] = useState<RelationshipDefinition | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");

  // Load relationship definitions where this type is source or target
  const { data: relDefs } = useGetList<RelationshipDefinition>(
    "relationship_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    },
  );

  // Relevant definitions: this entity type appears as source or target
  const relevantDefs = useMemo(
    () =>
      (relDefs || []).filter(
        (d) =>
          d.source_object_type === sourceType ||
          d.target_object_type === sourceType,
      ),
    [relDefs, sourceType],
  );

  // Load existing relationships where this entity is source or target
  const { data: outgoing, refetch: refetchOut } =
    useGetList<ObjectRelationship>("object_relationships", {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
      filter: { source_type: sourceType, source_id: sourceId },
    });

  const { data: incoming, refetch: refetchIncoming } =
    useGetList<ObjectRelationship>("object_relationships", {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
      filter: { target_type: sourceType, target_id: sourceId },
    });

  const allRelationships = useMemo(
    () => [...(outgoing || []), ...(incoming || [])],
    [outgoing, incoming],
  );

  // Load custom object definitions for labels
  const { data: customObjects } = useGetList<CustomObjectDefinition>(
    "custom_object_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "name", order: "ASC" },
    },
  );

  const [create] = useCreate();
  const [deleteOne] = useDelete();

  const getEntityLabel = useCallback(
    (type: string): string => {
      if (type === "contacts") return "Kontakte";
      if (type === "companies") return "Unternehmen";
      if (type === "deals") return "Deals";
      const customName = type.replace("custom_", "");
      const obj = customObjects?.find((o) => o.name === customName);
      return obj?.label || type;
    },
    [customObjects],
  );

  // For loading target records to select from
  const getTargetResource = useCallback((objectType: string): string => {
    if (objectType === "contacts") return "contacts";
    if (objectType === "companies") return "companies";
    if (objectType === "deals") return "deals";
    return "custom_object_data";
  }, []);

  // Load possible target records for the add dialog
  const targetObjectType = selectedRelDef
    ? selectedRelDef.source_object_type === sourceType
      ? selectedRelDef.target_object_type
      : selectedRelDef.source_object_type
    : null;

  const targetResource = targetObjectType ? getTargetResource(targetObjectType) : null;
  const targetIsCustom = targetObjectType?.startsWith("custom_") || false;
  const targetCustomName = targetIsCustom ? targetObjectType!.replace("custom_", "") : null;
  const targetObjDef = targetCustomName
    ? customObjects?.find((o) => o.name === targetCustomName)
    : null;

  const { data: targetRecords } = useGetList(
    targetResource || "contacts",
    {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "id", order: "ASC" },
      filter: targetIsCustom && targetObjDef
        ? { object_definition_id: targetObjDef.id }
        : {},
    },
  );

  // Load related record data for display (contacts, companies, deals, custom_object_data)
  // We'll resolve display names inline from loaded data
  const relatedContactIds = allRelationships
    .filter((r) =>
      (r.source_type === "contacts" && r.source_id !== sourceId) ||
      (r.target_type === "contacts"),
    )
    .map((r) => (r.source_type === "contacts" ? r.source_id : r.target_id));

  const { data: relatedContacts } = useGetList("contacts", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "id", order: "ASC" },
    filter: relatedContactIds.length > 0 ? { "id@in": `(${relatedContactIds.join(",")})` } : { id: -1 },
  });

  const getRecordLabel = useCallback(
    (type: string, id: number): string => {
      if (type === "contacts") {
        const c = relatedContacts?.find((r) => r.id === id);
        return c ? `${c.first_name} ${c.last_name}` : `Kontakt #${id}`;
      }
      if (type === "companies" || type === "deals") {
        return `${getEntityLabel(type)} #${id}`;
      }
      return `${getEntityLabel(type)} #${id}`;
    },
    [relatedContacts, getEntityLabel],
  );

  const getTargetRecordLabel = useCallback(
    (record: any): string => {
      if (!targetObjectType) return `#${record.id}`;
      if (targetObjectType === "contacts") {
        return `${record.first_name || ""} ${record.last_name || ""}`.trim() || `#${record.id}`;
      }
      if (targetObjectType === "companies") return record.name || `#${record.id}`;
      if (targetObjectType === "deals") return record.name || `#${record.id}`;
      // Custom object — use data field or id
      if (record.data) {
        const displayValue = record.data.name || record.data.title || record.data.label || record.data.bezeichnung;
        if (displayValue) return String(displayValue);
      }
      return `#${record.id}`;
    },
    [targetObjectType],
  );

  const handleAdd = async () => {
    if (!selectedRelDef || !selectedTargetId) return;

    const isOutgoing = selectedRelDef.source_object_type === sourceType;

    try {
      await create("object_relationships", {
        data: {
          source_type: isOutgoing ? sourceType : targetObjectType,
          source_id: isOutgoing ? sourceId : parseInt(selectedTargetId),
          target_type: isOutgoing ? targetObjectType : sourceType,
          target_id: isOutgoing ? parseInt(selectedTargetId) : sourceId,
          relationship_type: selectedRelDef.relationship_name,
        },
      });
      notify("Verknüpfung erstellt", { type: "success" });
      setAddDialogOpen(false);
      setSelectedRelDef(null);
      setSelectedTargetId("");
      refetchOut();
      refetchIncoming();
      refresh();
    } catch {
      notify("Fehler beim Erstellen der Verknüpfung", { type: "error" });
    }
  };

  const handleRemove = async (relationshipId: number) => {
    try {
      await deleteOne("object_relationships", {
        id: relationshipId,
        previousData: { id: relationshipId },
      });
      notify("Verknüpfung entfernt", { type: "success" });
      refetchOut();
      refetchIncoming();
      refresh();
    } catch {
      notify("Fehler beim Entfernen", { type: "error" });
    }
  };

  if (relevantDefs.length === 0) return null;

  // Group relationships by relationship type
  const grouped = allRelationships.reduce(
    (acc, rel) => {
      const key = rel.relationship_type || "Sonstige";
      if (!acc[key]) acc[key] = [];
      acc[key].push(rel);
      return acc;
    },
    {} as Record<string, ObjectRelationship[]>,
  );

  return (
    <Collapsible defaultOpen>
      <Card>
        <CardHeader className="py-3">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              {title}
              {allRelationships.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {allRelationships.length}
                </Badge>
              )}
            </CardTitle>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {Object.entries(grouped).map(([type, rels]) => (
              <div key={type}>
                <p className="text-xs font-medium text-muted-foreground mb-1">{type}</p>
                <div className="space-y-1">
                  {rels.map((rel) => {
                    const otherType =
                      rel.source_type === sourceType && rel.source_id === sourceId
                        ? rel.target_type
                        : rel.source_type;
                    const otherId =
                      rel.source_type === sourceType && rel.source_id === sourceId
                        ? rel.target_id
                        : rel.source_id;

                    return (
                      <div
                        key={rel.id}
                        className="flex items-center justify-between py-1 px-2 rounded hover:bg-accent/50 group"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="text-xs">
                            {getEntityLabel(otherType)}
                          </Badge>
                          <span>{getRecordLabel(otherType, otherId)}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                          onClick={() => handleRemove(rel.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {allRelationships.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Keine Verknüpfungen vorhanden
              </p>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Verknüpfung hinzufügen
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>

      {/* Add relationship dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Verknüpfung hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Beziehungstyp</label>
              <Select
                value={selectedRelDef ? String(selectedRelDef.id) : ""}
                onValueChange={(v) => {
                  const def = relevantDefs.find((d) => d.id === parseInt(v));
                  setSelectedRelDef(def || null);
                  setSelectedTargetId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Beziehung wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {relevantDefs.map((def) => {
                    const isOutgoing = def.source_object_type === sourceType;
                    const otherType = isOutgoing
                      ? def.target_object_type
                      : def.source_object_type;
                    return (
                      <SelectItem key={def.id} value={String(def.id)}>
                        {def.relationship_name} → {getEntityLabel(otherType)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {selectedRelDef && targetRecords && (
              <div>
                <label className="text-sm font-medium">
                  {getEntityLabel(targetObjectType!)} wählen
                </label>
                <Select
                  value={selectedTargetId}
                  onValueChange={setSelectedTargetId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Eintrag wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {targetRecords.map((record) => (
                      <SelectItem key={record.id} value={String(record.id)}>
                        {getTargetRecordLabel(record)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!selectedRelDef || !selectedTargetId}
            >
              Verknüpfen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
};

export default RelationshipManager;
