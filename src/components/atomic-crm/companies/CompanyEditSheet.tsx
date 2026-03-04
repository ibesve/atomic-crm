import { RecordRepresentation, useTranslate, type Identifier } from "ra-core";
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
  const translate = useTranslate();

  return (
    <EditSheet
      resource="companies"
      id={companyId}
      title={
        <span className="text-xl font-semibold">
          Edit <RecordRepresentation />
        </span>
      }
      open={open}
      onOpenChange={onOpenChange}
    >
      <CompanyInputs />

      <Separator />
      <RelationshipManager
        sourceType="companies"
        sourceId={companyId as number}
        title={translate("crm.relationships", { _: "Verknüpfungen" })}
      />
    </EditSheet>
  );
};
