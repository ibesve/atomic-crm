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

  const softDelete = useCallback(
    async (id: number | string, options?: SoftDeleteOptions) => {
      try {
        // Setze deleted_at statt echtem Delete
        await dataProvider.update(resource, {
          id,
          data: { deleted_at: new Date().toISOString() },
          previousData: { id },
        });

        notify(translate("ra.notification.deleted", { smart_count: 1 }), {
          type: "success",
        });
        refresh();
        options?.onSuccess?.();
        return true;
      } catch (error: unknown) {
        const _msg = error instanceof Error ? error.message : translate("ra.notification.http_error");
        notify(_msg, {
          type: "error",
        });
        options?.onError?.(error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    },
    [dataProvider, resource, notify, translate, refresh]
  );

  const restore = useCallback(
    async (id: number | string, options?: SoftDeleteOptions) => {
      try {
        await dataProvider.update(resource, {
          id,
          data: { deleted_at: null },
          previousData: { id },
        });

        notify(
          translate("crm.soft_delete.restored", { _: "Eintrag wiederhergestellt" }),
          { type: "success" }
        );
        refresh();
        options?.onSuccess?.();
        return true;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : translate("ra.notification.http_error");
        notify(message, {
          type: "error",
        });
        options?.onError?.(error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    },
    [dataProvider, resource, notify, translate, refresh]
  );

  const bulkSoftDelete = useCallback(
    async (ids: (number | string)[], options?: SoftDeleteOptions) => {
      try {
        await Promise.all(
          ids.map((id) =>
            dataProvider.update(resource, {
              id,
              data: { deleted_at: new Date().toISOString() },
              previousData: { id },
            })
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
        const _msg = error instanceof Error ? error.message : translate("ra.notification.http_error");
        notify(_msg, {
          type: "error",
        });
        options?.onError?.(error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    },
    [dataProvider, resource, notify, translate, refresh]
  );

  const bulkRestore = useCallback(
    async (ids: (number | string)[], options?: SoftDeleteOptions) => {
      try {
        await Promise.all(
          ids.map((id) =>
            dataProvider.update(resource, {
              id,
              data: { deleted_at: null },
              previousData: { id },
            })
          )
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
        const _msg = error instanceof Error ? error.message : translate("ra.notification.http_error");
        notify(_msg, {
          type: "error",
        });
        options?.onError?.(error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    },
    [dataProvider, resource, notify, translate, refresh]
  );

  return {
    softDelete,
    restore,
    bulkSoftDelete,
    bulkRestore,
  };
}

export default useSoftDelete;
