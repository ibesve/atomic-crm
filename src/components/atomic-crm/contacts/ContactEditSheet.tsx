import { RecordRepresentation, useTranslate, type Identifier } from "ra-core";
import { EditSheet } from "../misc/EditSheet";
import { ContactInputs } from "./ContactInputs";
import { RelationshipManager } from "../custom-objects/RelationshipManager";
import { Separator } from "@/components/ui/separator";
import { AddTask } from "../tasks/AddTask";
import { AddNote } from "../notes/AddNote";

export interface ContactEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: Identifier;
}

export const ContactEditSheet = ({
  open,
  onOpenChange,
  contactId,
}: ContactEditSheetProps) => {
  const translate = useTranslate();

  return (
    <EditSheet
      resource="contacts"
      id={contactId}
      title={
        <span className="text-xl font-semibold">
          Edit <RecordRepresentation />
        </span>
      }
      open={open}
      onOpenChange={onOpenChange}
    >
      <ContactInputs />

      <Separator />
      <div className="space-y-2">
        <h3 className="font-medium text-sm">
          {translate("crm.quick_actions", { _: "Schnellaktionen" })}
        </h3>
        <div className="flex gap-2 flex-wrap">
          <AddTask display="chip" />
          <AddNote reference="contacts" display="chip" />
        </div>
      </div>

      <Separator />
      <RelationshipManager
        sourceType="contacts"
        sourceId={contactId as number}
        title="Verknüpfungen"
      />
    </EditSheet>
  );
};
