import { useCallback } from "react";
import { useGetList, useDataProvider } from "ra-core";

export type AuditAction = 
  | "create" 
  | "update" 
  | "delete" 
  | "restore" 
  | "export" 
  | "import" 
  | "merge" 
  | "bulk_delete" 
  | "bulk_update";

export interface AuditLog {
  id: number;
  created_at: string;
  user_id: string;
  user_email: string;
  user_name: string;
  action: AuditAction;
  resource_type: string;
  resource_id: number;
  resource_name: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_fields: string[] | null;
  metadata: Record<string, unknown> | null;
  batch_id: string | null;
  affected_count: number;
}

export interface UseAuditLogOptions {
  resourceType?: string;
  resourceId?: number;
  action?: AuditAction;
  userId?: string;
  limit?: number;
}

export function useAuditLog(options: UseAuditLogOptions = {}) {
  const { resourceType, resourceId, action, userId, limit = 100 } = options;

  // Filter aufbauen
  const filter: Record<string, unknown> = {};
  if (resourceType) filter.resource_type = resourceType;
  if (resourceId) filter.resource_id = resourceId;
  if (action) filter.action = action;
  if (userId) filter.user_id = userId;

  const { data, total, isPending, error, refetch } = useGetList<AuditLog>(
    "audit_logs",
    {
      pagination: { page: 1, perPage: limit },
      sort: { field: "created_at", order: "DESC" },
      filter,
    }
  );

  return {
    auditLogs: data || [],
    total: total || 0,
    isPending,
    error,
    refetch,
  };
}

export function useCreateAuditLog() {
  const dataProvider = useDataProvider();

  const createAuditLog = useCallback(
    async (params: {
      action: AuditAction;
      resourceType: string;
      resourceId?: number;
      resourceName?: string;
      oldValues?: Record<string, unknown>;
      newValues?: Record<string, unknown>;
      changedFields?: string[];
      metadata?: Record<string, unknown>;
      batchId?: string;
      affectedCount?: number;
    }) => {
      try {
        await dataProvider.create("audit_logs", {
          data: {
            action: params.action,
            resource_type: params.resourceType,
            resource_id: params.resourceId,
            resource_name: params.resourceName,
            old_values: params.oldValues,
            new_values: params.newValues,
            changed_fields: params.changedFields,
            metadata: params.metadata,
            batch_id: params.batchId,
            affected_count: params.affectedCount || 1,
          },
        });
        return true;
      } catch {
        // Audit log creation failure should not block the main operation
        return false;
      }
    },
    [dataProvider]
  );

  // Spezielle Funktion für Export-Logging
  const logExport = useCallback(
    async (params: {
      resourceType: string;
      exportedIds: (number | string)[];
      exportFormat: string;
      additionalMetadata?: Record<string, unknown>;
    }) => {
      return createAuditLog({
        action: "export",
        resourceType: params.resourceType,
        resourceName: `Export von ${params.exportedIds.length} ${params.resourceType}`,
        metadata: {
          exported_ids: params.exportedIds,
          export_format: params.exportFormat,
          ...params.additionalMetadata,
        },
        affectedCount: params.exportedIds.length,
      });
    },
    [createAuditLog]
  );

  return {
    createAuditLog,
    logExport,
  };
}

// Hilfsfunktion um Änderungen zwischen zwei Objekten zu finden
export function getChangedFields(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): { changedFields: string[]; changes: Record<string, { old: unknown; new: unknown }> } {
  const changedFields: string[] = [];
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

  for (const key of allKeys) {
    // Ignoriere Meta-Felder
    if (["updated_at", "last_seen", "created_at"].includes(key)) continue;

    const oldVal = oldValues[key];
    const newVal = newValues[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changedFields.push(key);
      changes[key] = { old: oldVal, new: newVal };
    }
  }

  return { changedFields, changes };
}

export default useAuditLog;
