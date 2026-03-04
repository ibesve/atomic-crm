import { useTranslate } from "ra-core";
import { Link2 } from "lucide-react";
import { RelationshipDefinitionManager } from "../custom-objects/RelationshipDefinitionManager";

export const RelationshipsPage = () => {
  const translate = useTranslate();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Link2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {translate("crm.relationships", { _: "Verknüpfungen" })}
          </h1>
          <p className="text-muted-foreground">
            {translate("crm.relationships_description", {
              _: "Verwalten Sie Beziehungen zwischen Kontakten, Unternehmen, Deals und benutzerdefinierten Objekten",
            })}
          </p>
        </div>
      </div>

      <RelationshipDefinitionManager />
    </div>
  );
};

RelationshipsPage.path = "/relationships";

export default RelationshipsPage;
