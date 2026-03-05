import { History } from "lucide-react";
import {
  useRecordContext,
  useResourceContext,
  useTranslate,
} from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { RecordTimeline } from "./record-timeline";

export interface RevisionsButtonProps {
  label?: string;
  size?: "default" | "sm" | "lg" | "icon";
  resource?: string;
  className?: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
}

/**
 * A button that opens a Sheet/Drawer showing the revisions timeline
 * for the current record.
 */
export const RevisionsButton = ({
  label: labelProp,
  size = "sm",
  variant = "outline",
  className,
}: RevisionsButtonProps) => {
  const translate = useTranslate();
  const record = useRecordContext();
  const resource = useResourceContext();

  const label =
    labelProp ??
    translate("ra-history.action.show_revisions", { _: "Versionen" });

  if (!record) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <History className="h-4 w-4" />
          {label}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[450px] sm:w-[540px] sm:max-w-none">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {translate("ra-history.revisions_for", {
              _: "Versionen",
            })}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <RecordTimeline
            resource={resource}
            recordId={record.id}
            maxHeight="calc(100vh - 200px)"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
