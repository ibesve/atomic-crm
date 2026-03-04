import { useCallback } from "react";
import { useDataProvider, useNotify, useRefresh, useTranslate } from "ra-core";

export interface SoftDeleteOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useSoftDelete(resource: string) {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const translate = useTranslate();

  const handleError = useCallback(
    (error: unknown, options?: SoftDeleteOptions) => {
      const err = error instanceof Error ? error : new Error(String(error));
      notify(err.message || translate("ra.notification.http_error"), {
        type: "error",
      });
      options?.onError?.(err);
    },
    [notify, translate]
  );

  const updateRecord = useCallback(
    (id: number | string, data: Record<string, unknown>) =>
      dataProvider.update(resource, { id, data, previousData: { id } }),
    [dataProvider, resource]
  );

  const softDelete = useCallback(
    async (id: number | string, options?: SoftDeleteOptions) => {
      try {
        await updateRecord(id, { deleted_at: new Date().toISOString() });
        notify(translate("ra.notification.deleted", { smart_count: 1 }), {
          type: "success",
        });
        refresh();
        options?.onSuccess?.();
        return true;
      } catch (error: unknown) {
        handleError(error, options);
        return false;
      }
    },
    [updateRecord, notify, translate, refresh, handleError]
  );

  const restore = useCallback(
    async (id: number | string, options?: SoftDeleteOptions) => {
      try {
        await updateRecord(id, { deleted_at: null });
        notify(
          translate("crm.soft_delete.restored", { _: "Eintrag wiederhergestellt" }),
          { type: "success" }
        );
        refresh();
        options?.onSuccess?.();
        return true;
      } catch (error: unknown) {
        handleError(error, options);
        return false;
      }
    },
    [updateRecord, notify, translate, refresh, handleError]
  );

  const bulkSoftDelete = useCallback(
    async (ids: (number | string)[], options?: SoftDeleteOptions) => {
      try {
        await Promise.all(
          ids.map((id) =>
            updateRecord(id, { deleted_at: new Date().toISOString() })
          )
        );
        notify(
          translate("ra.notification.deleted", { smart_count: ids.length }),
          { type: "success" }
        );
        refresh();
        options?.onSuccess?.();
        return true;
      } catch (error: unknown) {
        handleError(error, options);
        return false;
      }
    },
    [updateRecord, notify, translate, refresh, handleError]
  );

  const bulkRestore = useCallback(
    async (ids: (number | string)[], options?: SoftDeleteOptions) => {
      try {
        await Promise.all(
          ids.map((id) => updateRecord(id, { deleted_at: null }))
        );
        notify(
          translate("crm.soft_delete.restored_count", {
            _: `${ids.length} Einträge wiederhergestellt`,
            count: ids.length,
          }),
          { type: "success" }
        );
        refresh();
        options?.onSuccess?.();
        return true;
      } catch (error: unknown) {
        handleError(error, options);
        return false;
      }
    },
    [updateRecord, notify, translate, refresh, handleError]
  );

  return {
    softDelete,
    restore,
    bulkSoftDelete,
    bulkRestore,
  };
}

export default useSoftDelete;
