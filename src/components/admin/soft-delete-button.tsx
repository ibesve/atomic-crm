import * as React from "react";
import { Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { humanize, singularize } from "inflection";
import type { RedirectionSideEffect } from "ra-core";
import {
  useRecordContext,
  useResourceContext,
  useTranslate,
  useGetRecordRepresentation,
  useResourceTranslation,
} from "ra-core";
import { useSoftDeleteWithUndoController } from "@react-admin/ra-core-ee";

export type SoftDeleteButtonProps = {
  label?: string;
  size?: "default" | "sm" | "lg" | "icon";
  onClick?: React.ReactEventHandler<HTMLButtonElement>;
  mutationOptions?: any;
  redirect?: RedirectionSideEffect;
  resource?: string;
  successMessage?: string;
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
 * A button that soft-deletes a record (sets deleted_at) with undo support.
 * Uses the EE useSoftDeleteWithUndoController hook.
 */
export const SoftDeleteButton = (props: SoftDeleteButtonProps) => {
  const {
    label: labelProp,
    onClick,
    size,
    mutationOptions,
    redirect = "list",
    successMessage,
    variant = "outline",
    className = "cursor-pointer hover:bg-destructive/10! text-destructive! border-destructive! focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
  } = props;
  const record = useRecordContext(props);
  const resource = useResourceContext(props);

  const { isPending, handleSoftDelete } = useSoftDeleteWithUndoController({
    record,
    resource,
    redirect,
    onClick,
    mutationOptions,
    successMessage,
  });

  const translate = useTranslate();
  const getRecordRepresentation = useGetRecordRepresentation(resource);
  let recordRepresentation = getRecordRepresentation(record);
  const resourceName = translate(`resources.${resource}.forcedCaseName`, {
    smart_count: 1,
    _: humanize(
      translate(`resources.${resource}.name`, {
        smart_count: 1,
        _: resource ? singularize(resource) : undefined,
      }),
      true,
    ),
  });

  if (React.isValidElement(recordRepresentation)) {
    recordRepresentation = `#${record?.id}`;
  }

  const label = useResourceTranslation({
    resourceI18nKey: `resources.${resource}.action.delete`,
    baseI18nKey: "ra.action.delete",
    options: {
      name: resourceName,
      recordRepresentation,
    },
    userText: labelProp,
  });

  return (
    <Button
      variant={variant}
      type="button"
      onClick={handleSoftDelete}
      disabled={isPending}
      aria-label={typeof label === "string" ? label : undefined}
      size={size}
      className={className}
    >
      <Trash />
      {label}
    </Button>
  );
};
