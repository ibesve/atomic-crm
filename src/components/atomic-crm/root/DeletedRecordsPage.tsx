import { useTranslate } from "ra-core";
import { Trash2 } from "lucide-react";
import { DeletedRecordsList } from "@/components/admin/deleted-records-list";

export function DeletedRecordsPage() {
  const translate = useTranslate();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-destructive/10">
          <Trash2 className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {translate("ra-soft-delete.page_title", { _: "Papierkorb" })}
          </h1>
          <p className="text-muted-foreground">
            {translate("ra-soft-delete.page_description", {
              _: "Gelöschte Kontakte, Unternehmen und Deals wiederherstellen oder endgültig löschen",
            })}
          </p>
        </div>
      </div>

      <DeletedRecordsList />
    </div>
  );
}

export default DeletedRecordsPage;
