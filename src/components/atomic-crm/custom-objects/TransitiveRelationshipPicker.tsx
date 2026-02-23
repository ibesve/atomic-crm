import { useState, useMemo, useCallback } from "react";
import {
  useGetList,
  useCreate,
  useTranslate,
  useNotify,
  useRefresh,
} from "ra-core";
import { Button } from "@/components/ui/button";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  ObjectRelationship,
  CustomObjectDefinition,
} from "../types/custom-objects";

interface TransitiveRelationshipPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The starting entity type, e.g. "contacts" */
  sourceType: string;
  /** The starting record ID */
  sourceId: number;
}

/**
 * Cascading picker for multi-hop relationship assignment.
 * 
 * Given a source entity (e.g., a Contact), this picker:
 * 1. Shows existing direct relationships (e.g., Events the contact participates in)
 * 2. For each selected intermediate, shows available targets (e.g., Hotelzimmer linked to the Event)
 * 3. Allows creating a direct relationship between the source and a transitively-linked entity
 * 
 * This enables the use case: Contact → Event → Hotelzimmer → Hotel
 * where a contact can be assigned a Hotelzimmer through an Event.
 */
export const TransitiveRelationshipPicker = ({
  open,
  onOpenChange,
  sourceType,
  sourceId,
}: TransitiveRelationshipPickerProps) => {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [create] = useCreate();

  // Step tracking: each step is { objectType, recordId }
  const [steps, setSteps] = useState<Array<{ objectType: string; recordId: number | null }>>([]);

  // Load custom objects for labels
  const { data: customObjects } = useGetList<CustomObjectDefinition>(
    "custom_object_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "name", order: "ASC" },
    },
  );

  // Load existing direct relationships for the source
  const { data: outgoing } = useGetList<ObjectRelationship>(
    "object_relationships",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
      filter: { source_type: sourceType, source_id: sourceId },
    },
  );

  const { data: incoming } = useGetList<ObjectRelationship>(
    "object_relationships",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
      filter: { target_type: sourceType, target_id: sourceId },
    },
  );

  const directRelationships = useMemo(
    () => [...(outgoing || []), ...(incoming || [])],
    [outgoing, incoming],
  );

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

  // Build unique linked records for the first hop
  const firstHopRecords = useMemo(() => {
    const records: Array<{ type: string; id: number; label: string }> = [];
    const seen = new Set<string>();
    for (const rel of directRelationships) {
      const otherType =
        rel.source_type === sourceType && rel.source_id === sourceId
          ? rel.target_type
          : rel.source_type;
      const otherId =
        rel.source_type === sourceType && rel.source_id === sourceId
          ? rel.target_id
          : rel.source_id;
      const key = `${otherType}_${otherId}`;
      if (!seen.has(key)) {
        seen.add(key);
        records.push({
          type: otherType,
          id: otherId,
          label: `${getEntityLabel(otherType)} #${otherId}`,
        });
      }
    }
    return records;
  }, [directRelationships, sourceType, sourceId, getEntityLabel]);

  // For step N: load relationships of the selected intermediate record
  const currentStep = steps.length > 0 ? steps[steps.length - 1] : null;
  const currentType = currentStep?.objectType || sourceType;
  const currentId = currentStep?.recordId || sourceId;

  // Load relationships from the current intermediate
  const { data: stepOutgoing } = useGetList<ObjectRelationship>(
    "object_relationships",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
      filter:
        currentStep?.recordId
          ? { source_type: currentType, source_id: currentId }
          : { id: -1 },
    },
  );

  const { data: stepIncoming } = useGetList<ObjectRelationship>(
    "object_relationships",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
      filter:
        currentStep?.recordId
          ? { target_type: currentType, target_id: currentId }
          : { id: -1 },
    },
  );

  const nextHopRecords = useMemo(() => {
    if (!currentStep?.recordId) return [];
    const allRels = [...(stepOutgoing || []), ...(stepIncoming || [])];
    const records: Array<{ type: string; id: number; label: string }> = [];
    const seen = new Set<string>();
    for (const rel of allRels) {
      const otherType =
        rel.source_type === currentType && rel.source_id === currentId
          ? rel.target_type
          : rel.source_type;
      const otherId =
        rel.source_type === currentType && rel.source_id === currentId
          ? rel.target_id
          : rel.source_id;
      // Don't go back to source
      if (otherType === sourceType && otherId === sourceId) continue;
      // Don't revisit steps
      if (steps.some((s) => s.objectType === otherType && s.recordId === otherId)) continue;

      const key = `${otherType}_${otherId}`;
      if (!seen.has(key)) {
        seen.add(key);
        records.push({
          type: otherType,
          id: otherId,
          label: `${getEntityLabel(otherType)} #${otherId}`,
        });
      }
    }
    return records;
  }, [currentStep, stepOutgoing, stepIncoming, currentType, currentId, sourceType, sourceId, steps, getEntityLabel]);

  const handleSelectFirstHop = (value: string) => {
    const [type, id] = value.split("__");
    setSteps([{ objectType: type, recordId: parseInt(id) }]);
    
  };

  const handleSelectNextHop = (value: string) => {
    const [type, id] = value.split("__");
    setSteps((prev) => [...prev, { objectType: type, recordId: parseInt(id) }]);
    
  };

  const handleAssign = async () => {
    // Create a direct relationship from source to the final target
    const finalStep = steps[steps.length - 1];
    if (!finalStep?.recordId) return;

    try {
      await create("object_relationships", {
        data: {
          source_type: sourceType,
          source_id: sourceId,
          target_type: finalStep.objectType,
          target_id: finalStep.recordId,
          relationship_type: `transitive_via_${steps.map((s) => s.objectType).join("_")}`,
        },
      });
      notify("Transitive Verknüpfung erstellt", { type: "success" });
      onOpenChange(false);
      setSteps([]);
      
      refresh();
    } catch {
      notify("Fehler beim Erstellen", { type: "error" });
    }
  };

  const handleReset = () => {
    setSteps([]);
    
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {translate("crm.transitive_assignment", {
              _: "Transitive Zuordnung",
            })}
          </DialogTitle>
          <DialogDescription>
            Folgen Sie der Beziehungskette, um ein verknüpftes Objekt direkt
            zuzuordnen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Breadcrumb of current path */}
          <div className="flex items-center gap-1 flex-wrap text-sm">
            <Badge variant="default">{getEntityLabel(sourceType)} #{sourceId}</Badge>
            {steps.map((step, i) => (
              <span key={i} className="flex items-center gap-1">
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge
                  variant={i === steps.length - 1 ? "default" : "secondary"}
                >
                  {step.recordId
                    ? `${getEntityLabel(step.objectType)} #${step.recordId}`
                    : getEntityLabel(step.objectType)}
                </Badge>
              </span>
            ))}
          </div>

          {/* Step 1: Select from direct relationships */}
          {steps.length === 0 && (
            <div>
              <label className="text-sm font-medium mb-1 block">
                Schritt 1: Wählen Sie ein verknüpftes Objekt
              </label>
              {firstHopRecords.length > 0 ? (
                <Select onValueChange={handleSelectFirstHop}>
                  <SelectTrigger>
                    <SelectValue placeholder="Verknüpftes Objekt wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {firstHopRecords.map((r) => (
                      <SelectItem
                        key={`${r.type}__${r.id}`}
                        value={`${r.type}__${r.id}`}
                      >
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Keine direkten Verknüpfungen vorhanden. Erstellen Sie zuerst
                  Verknüpfungen über den Beziehungsmanager.
                </p>
              )}
            </div>
          )}

          {/* Subsequent steps: explore further hops */}
          {steps.length > 0 && nextHopRecords.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-1 block">
                Schritt {steps.length + 1}: Weiter navigieren oder zuordnen
              </label>
              <Select onValueChange={handleSelectNextHop}>
                <SelectTrigger>
                  <SelectValue placeholder="Nächstes Objekt wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {nextHopRecords.map((r) => (
                    <SelectItem
                      key={`${r.type}__${r.id}`}
                      value={`${r.type}__${r.id}`}
                    >
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {steps.length > 0 && nextHopRecords.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Keine weiteren Verknüpfungen in dieser Richtung.
            </p>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {steps.length > 0 && (
            <Button variant="outline" onClick={handleReset} className="mr-auto">
              Zurücksetzen
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          {steps.length > 0 && steps[steps.length - 1]?.recordId && (
            <Button onClick={handleAssign}>
              <Plus className="h-4 w-4 mr-1" />
              Direkt zuordnen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransitiveRelationshipPicker;
