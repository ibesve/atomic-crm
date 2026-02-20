import type {
  ExtractRecordPaths,
  LinkToType,
  RaRecord,
  UseReferenceFieldControllerResult,
} from "ra-core";
import {
  ReferenceFieldBase,
  useFieldValue,
  useGetRecordRepresentation,
  useReferenceFieldContext,
  useTranslate,
  useGetOne,
  useRecordContext,
} from "ra-core";
import type { MouseEvent, ReactNode } from "react";
import { useMemo } from "react";
import { Link } from "react-router";
import type { UseQueryOptions } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Displays a field from a related record by following a foreign key relationship.
 */
export const ReferenceField = <
  RecordType extends RaRecord = RaRecord,
  ReferenceRecordType extends RaRecord = RaRecord,
>(
  props: ReferenceFieldProps<RecordType, ReferenceRecordType>,
) => {
  const { loading, error, empty, render, ...rest } = props;
  const id = useFieldValue<RecordType>(props);
  const translate = useTranslate();

  return id == null ? (
    typeof empty === "string" ? (
      <>{empty && translate(empty, { _: empty })}</>
    ) : (
      empty
    )
  ) : (
    <ReferenceFieldBase {...rest}>
      <ReferenceFieldView<ReferenceRecordType>
        render={render}
        loading={loading}
        error={error}
        {...rest}
      />
    </ReferenceFieldBase>
  );
};

export interface ReferenceFieldProps<
  RecordType extends RaRecord = RaRecord,
  ReferenceRecordType extends RaRecord = RaRecord,
> extends Partial<ReferenceFieldViewProps<ReferenceRecordType>> {
  children?: ReactNode;
  queryOptions?: UseQueryOptions<RaRecord[], Error> & {
    meta?: Record<string, unknown>;
  };
  record?: RecordType;
  reference: string;
  translateChoice?: ((record: ReferenceRecordType) => string) | boolean;
  link?: LinkToType;
  source: ExtractRecordPaths<RecordType>;
}

const stopPropagation = (e: MouseEvent<HTMLAnchorElement>) =>
  e.stopPropagation();

export const ReferenceFieldView = <
  ReferenceRecordType extends RaRecord = RaRecord,
>(
  props: ReferenceFieldViewProps<ReferenceRecordType>,
) => {
  const {
    children,
    className,
    empty,
    error: errorElement,
    render,
    reference,
    loading,
  } = props;
  const referenceFieldContext = useReferenceFieldContext();
  const { error, link, isPending, referenceRecord } = referenceFieldContext;
  const getRecordRepresentation = useGetRecordRepresentation(reference);
  const translate = useTranslate();

  if (!referenceRecord && error && errorElement !== false) {
    return errorElement;
  }
  if (isPending && loading !== false) {
    return loading;
  }
  if (!referenceRecord && empty !== false) {
    return typeof empty === "string" ? (
      <>{empty && translate(empty, { _: empty })}</>
    ) : (
      empty
    );
  }

  const child = render
    ? render(referenceFieldContext)
    : children || <span>{getRecordRepresentation(referenceRecord)}</span>;

  if (link) {
    return (
      <span className={className}>
        <Link to={link} onClick={stopPropagation}>
          {child}
        </Link>
      </span>
    );
  }

  return <>{child}</>;
};

export interface ReferenceFieldViewProps<
  ReferenceRecordType extends RaRecord = RaRecord,
> {
  children?: ReactNode;
  className?: string;
  empty?: ReactNode;
  loading?: ReactNode;
  render?: (props: UseReferenceFieldControllerResult) => ReactNode;
  reference: string;
  source: string;
  resource?: string;
  translateChoice?: ((record: ReferenceRecordType) => string) | boolean;
  resourceLinkPath?: LinkToType;
  error?: ReactNode;
}

/**
 * Zeigt mehrere verknüpfte Objekte als klickbare Links an (für Many-to-Many)
 */
interface ReferenceManyFieldProps {
  source: string;
  reference: string;
  link?: boolean | "show" | "edit";
  optionText?: string | ((record: RaRecord) => ReactNode);
  className?: string;
  emptyText?: string;
  separator?: string;
}

export function ReferenceManyField({
  source,
  reference,
  link = true,
  optionText = "name",
  className,
  emptyText = "-",
  separator = ", ",
}: ReferenceManyFieldProps) {
  const record = useRecordContext();
  const referenceIds: (string | number)[] = record?.[source] || [];

  if (!referenceIds.length) {
    return <span className="text-muted-foreground">{emptyText}</span>;
  }

  return (
    <span className={cn("inline-flex flex-wrap gap-1", className)}>
      {referenceIds.map((id, index) => (
        <span key={id}>
          <ReferenceManyFieldItem
            id={id}
            reference={reference}
            link={link}
            optionText={optionText}
          />
          {index < referenceIds.length - 1 && separator}
        </span>
      ))}
    </span>
  );
}

function ReferenceManyFieldItem({
  id,
  reference,
  link,
  optionText,
}: {
  id: string | number;
  reference: string;
  link: boolean | "show" | "edit";
  optionText: string | ((record: RaRecord) => ReactNode);
}) {
  const { data: referencedRecord, isPending } = useGetOne(
    reference,
    { id },
    { enabled: !!id }
  );

  const displayValue = useMemo(() => {
    if (!referencedRecord) return null;
    if (typeof optionText === "function") {
      return optionText(referencedRecord);
    }
    return referencedRecord[optionText];
  }, [referencedRecord, optionText]);

  if (isPending) {
    return <Skeleton className="h-4 w-16 inline-block" />;
  }

  if (!referencedRecord) {
    return <span>{id}</span>;
  }

  const linkPath =
    link === "edit" ? `/${reference}/${id}` : `/${reference}/${id}/show`;

  if (link) {
    return (
      <Link
        to={linkPath}
        className="text-primary hover:underline inline-flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        {displayValue}
        <ExternalLink className="h-3 w-3" />
      </Link>
    );
  }

  return <span>{displayValue}</span>;
}
