import { Plus } from "lucide-react";
import {
  CreateBase,
  Form,
  RecordRepresentation,
  useGetIdentity,
  useNotify,
  useRecordContext,
  useTranslate,
  useUpdate,
} from "ra-core";
import { useState } from "react";
import { SaveButton } from "@/components/admin/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { NoteInputs } from "./NoteInputs";
import { getCurrentDate } from "./utils";

export const AddNote = ({
  reference = "contacts",
  display = "chip",
}: {
  reference?: "contacts" | "deals";
  display?: "chip" | "icon";
}) => {
  const { identity } = useGetIdentity();
  const [update] = useUpdate();
  const notify = useNotify();
  const translate = useTranslate();
  const record = useRecordContext();
  const [open, setOpen] = useState(false);
  const handleOpen = () => {
    setOpen(true);
  };

  const foreignKey = reference === "contacts" ? "contact_id" : "deal_id";
  const noteResource =
    reference === "contacts" ? "contact_notes" : "deal_notes";

  const handleSuccess = async () => {
    setOpen(false);
    if (!record) return;
    await update(reference, {
      id: record.id,
      data: {
        last_seen:
          reference === "contacts" ? new Date().toISOString() : undefined,
      },
      previousData: record,
    });
    notify(translate("crm.note_added"));
  };

  if (!identity) return null;

  return (
    <>
      {display === "icon" ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="p-2 cursor-pointer"
                onClick={handleOpen}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {translate("crm.add_note", { _: "Notiz hinzufügen" })}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <div className="my-2">
          <Button
            variant="outline"
            className="h-6 cursor-pointer"
            onClick={handleOpen}
            size="sm"
          >
            <Plus className="w-4 h-4" />
            {translate("crm.add_note", { _: "Notiz hinzufügen" })}
          </Button>
        </div>
      )}

      <CreateBase
        resource={noteResource}
        record={{
          [foreignKey]: record?.id,
          date: getCurrentDate(),
          sales_id: identity.id,
          status: reference === "contacts" ? "warm" : undefined,
        }}
        transform={(data) => ({
          ...data,
          date: new Date(data.date || getCurrentDate()).toISOString(),
        })}
        mutationOptions={{ onSuccess: handleSuccess }}
      >
        <Dialog open={open} onOpenChange={() => setOpen(false)}>
          <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>
                  {translate("crm.add_note_for", {
                    _: "Neue Notiz erstellen für ",
                  })}
                  <RecordRepresentation
                    record={record}
                    resource={reference}
                  />
                </DialogTitle>
              </DialogHeader>
              <NoteInputs showStatus={reference === "contacts"} />
              <DialogFooter className="w-full justify-end">
                <SaveButton />
              </DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      </CreateBase>
    </>
  );
};
