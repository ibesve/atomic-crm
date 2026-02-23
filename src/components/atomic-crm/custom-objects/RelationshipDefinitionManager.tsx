import { useState } from "react";
import { useGetList, useCreate, useDelete, useTranslate, useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Trash2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  RelationshipDefinition,
  CustomObjectDefinition,
} from "../types/custom-objects";

const BUILT_IN_ENTITIES = [
  { value: "contacts", label: "Kontakte" },
  { value: "companies", label: "Unternehmen" },
  { value: "deals", label: "Deals" },
];

/**
 * Admin UI for defining relationships between entity/object types.
 * E.g., "Event has-many Hotelzimmer", "Hotelzimmer belongs-to Hotel"
 */
export const RelationshipDefinitionManager = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    source_object_type: "",
    target_object_type: "",
    relationship_name: "",
    inverse_name: "",
    cardinality: "many-to-many" as string,
  });

  const { data: definitions, refetch } = useGetList<RelationshipDefinition>(
    "relationship_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    },
  );

  const { data: customObjects } = useGetList<CustomObjectDefinition>(
    "custom_object_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "name", order: "ASC" },
      filter: { is_active: true, "deleted_at@is": "null" },
    },
  );

  const [create] = useCreate();
  const [deleteOne] = useDelete();

  const allEntityOptions = [
    ...BUILT_IN_ENTITIES,
    ...(customObjects || []).map((obj) => ({
      value: `custom_${obj.name}`,
      label: obj.label,
    })),
  ];

  const handleCreate = async () => {
    if (!formData.source_object_type || !formData.target_object_type || !formData.relationship_name) {
      notify("Bitte alle Pflichtfelder ausfüllen", { type: "warning" });
      return;
    }

    try {
      await create("relationship_definitions", { data: formData });
      notify("Beziehung erstellt", { type: "success" });
      setCreateOpen(false);
      setFormData({
        source_object_type: "",
        target_object_type: "",
        relationship_name: "",
        inverse_name: "",
        cardinality: "many-to-many",
      });
      refetch();
    } catch {
      notify("Fehler beim Erstellen", { type: "error" });
    }
  };

  const handleDeleteDef = async (id: number) => {
    try {
      await deleteOne("relationship_definitions", { id, previousData: { id } });
      notify("Beziehung gelöscht", { type: "success" });
      refetch();
    } catch {
      notify("Fehler beim Löschen", { type: "error" });
    }
  };

  const getLabel = (type: string) =>
    allEntityOptions.find((o) => o.value === type)?.label || type;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {translate("crm.relationship_definitions", { _: "Beziehungsdefinitionen" })}
          </h3>
          <p className="text-sm text-muted-foreground">
            {translate("crm.relationship_definitions_description", {
              _: "Definieren Sie Beziehungen zwischen Objekttypen (z.B. Event → Hotelzimmer → Hotel)",
            })}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {translate("ra.action.create", { _: "Erstellen" })}
        </Button>
      </div>

      {definitions && definitions.length > 0 ? (
        <div className="grid gap-3">
          {definitions.map((def) => (
            <Card key={def.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{getLabel(def.source_object_type)}</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline">{getLabel(def.target_object_type)}</Badge>
                  <span className="text-sm font-medium ml-2">{def.relationship_name}</span>
                  {def.inverse_name && (
                    <span className="text-xs text-muted-foreground">
                      (invers: {def.inverse_name})
                    </span>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {def.cardinality}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => handleDeleteDef(def.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Noch keine Beziehungsdefinitionen vorhanden
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Neue Beziehung definieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Quell-Objekt *</label>
              <Select
                value={formData.source_object_type}
                onValueChange={(v) => setFormData((p) => ({ ...p, source_object_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {allEntityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Ziel-Objekt *</label>
              <Select
                value={formData.target_object_type}
                onValueChange={(v) => setFormData((p) => ({ ...p, target_object_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {allEntityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Beziehungsname *</label>
              <Input
                value={formData.relationship_name}
                onChange={(e) => setFormData((p) => ({ ...p, relationship_name: e.target.value }))}
                placeholder="z.B. hat Teilnehmer"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Inverser Name</label>
              <Input
                value={formData.inverse_name}
                onChange={(e) => setFormData((p) => ({ ...p, inverse_name: e.target.value }))}
                placeholder="z.B. nimmt teil an"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Kardinalität</label>
              <Select
                value={formData.cardinality}
                onValueChange={(v) => setFormData((p) => ({ ...p, cardinality: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one-to-one">1:1</SelectItem>
                  <SelectItem value="one-to-many">1:N</SelectItem>
                  <SelectItem value="many-to-many">N:M</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreate}>Erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RelationshipDefinitionManager;
