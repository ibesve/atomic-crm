import { RecordRepresentation, type Identifier } from "ra-core";
import { EditSheet } from "../misc/EditSheet";
import { ContactInputs } from "./ContactInputs";
import { RelationshipManager } from "../custom-objects/RelationshipManager";
import { Separator } from "@/components/ui/separator";

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
  return (
    <EditSheet
      resource="contacts"
      id={contactId}
      title={
        <h1 className="text-xl font-semibold">
          Edit <RecordRepresentation />
        </h1>
      }
      open={open}
      onOpenChange={onOpenChange}
    >
      <ContactInputs />
      <Separator />
      <RelationshipManager
        sourceType="contacts"
        sourceId={contactId as number}
        title="Verknüpfungen"
      />
    </EditSheet>
  );
};
