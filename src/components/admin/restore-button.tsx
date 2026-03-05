import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useRecordContext,
  useResourceContext,
  useTranslate,
} from "ra-core";
import { useRestoreWithUndoController } from "@react-admin/ra-core-ee";

export type RestoreButtonProps = {
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
};

/**
 * A button that restores a soft-deleted record (sets deleted_at to null) with undo.
 * Uses the EE useRestoreWithUndoController hook.
 */
export const RestoreButton = (props: RestoreButtonProps) => {
  const {
    label: labelProp,
    size = "sm",
    variant = "outline",
    className = "",
  } = props;
  const record = useRecordContext(props);
  const resource = useResourceContext(props);
  const translate = useTranslate();

  const { isPending, handleRestore } = useRestoreWithUndoController({
    record,
    resource,
  });

  const label =
    labelProp ??
    translate("ra-soft-delete.action.restore", { _: "Wiederherstellen" });

  return (
    <Button
      variant={variant}
      type="button"
      onClick={handleRestore}
      disabled={isPending}
      aria-label={label}
      size={size}
      className={className}
    >
      <RotateCcw className="h-4 w-4" />
      {label}
    </Button>
  );
};
