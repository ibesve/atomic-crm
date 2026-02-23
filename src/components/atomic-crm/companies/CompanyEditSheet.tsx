import { RecordRepresentation, type Identifier } from "ra-core";
import { EditSheet } from "../misc/EditSheet";
import { CompanyInputs } from "./CompanyInputs";
import { RelationshipManager } from "../custom-objects/RelationshipManager";
import { Separator } from "@/components/ui/separator";

export interface CompanyEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: Identifier;
}

export const CompanyEditSheet = ({
  open,
  onOpenChange,
  companyId,
}: CompanyEditSheetProps) => {
  return (
    <EditSheet
      resource="companies"
      id={companyId}
      title={
        <h1 className="text-xl font-semibold">
          Edit <RecordRepresentation />
        </h1>
      }
      open={open}
      onOpenChange={onOpenChange}
    >
      <CompanyInputs />
      <Separator />
      <RelationshipManager
        sourceType="companies"
        sourceId={companyId as number}
        title="Verknüpfungen"
      />
    </EditSheet>
  );
};
