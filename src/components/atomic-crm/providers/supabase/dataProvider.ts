import { supabaseDataProvider } from "ra-supabase-core";
import {
  withLifecycleCallbacks,
  type DataProvider,
  type GetListParams,
  type Identifier,
  type ResourceCallbacks,
} from "ra-core";
import type {
  SoftDeleteDataProvider,
  DeletedRecordType,
  RecordRevision,
} from "@react-admin/ra-core-ee";
import { addRealTimeMethodsBasedOnSupabase } from "@react-admin/ra-realtime";
import { addSearchMethod } from "@react-admin/ra-search";
import { addTreeMethodsBasedOnParentAndPosition } from "@react-admin/ra-tree";
import type {
  ContactNote,
  Deal,
  DealNote,
  RAFile,
  Sale,
  SalesFormData,
  SignUpData,
} from "../../types";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import { getActivityLog } from "../commons/activity";
import { ATTACHMENTS_BUCKET } from "../commons/attachments";
import { getIsInitialized } from "./authProvider";
import { supabase } from "./supabase";

// ── Soft-deletable resources ──────────────────────────────────────────
const SOFT_DELETABLE_RESOURCES: Record<string, { deletedAtFieldName: string }> = {
  contacts: { deletedAtFieldName: "deleted_at" },
  companies: { deletedAtFieldName: "deleted_at" },
  deals: { deletedAtFieldName: "deleted_at" },
  tasks: { deletedAtFieldName: "deleted_at" },
  contact_notes: { deletedAtFieldName: "deleted_at" },
  deal_notes: { deletedAtFieldName: "deleted_at" },
};

// ── Custom Field helpers ──────────────────────────────────────────────
// Temporary storage for _cf_ values stripped in beforeSave,
// keyed by `${resource}_${recordId}` or a unique token for creates.
const pendingCustomFields = new Map<string, Record<string, unknown>>();
let pendingCreateCfData: Record<string, unknown> | null = null;

// ── Audit Log helper ──────────────────────────────────────────────────
/**
 * Write an audit log entry directly via the Supabase client.
 * Non-blocking: failures are silently logged to console so they never
 * disrupt the main data operation.
 */
async function createAuditLogEntry(params: {
  action: "create" | "update" | "delete" | "restore" | "merge";
  resourceType: string;
  resourceId?: number;
  resourceName?: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  changedFields?: string[] | null;
  metadata?: Record<string, unknown> | null;
  affectedCount?: number;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      user_name: user?.user_metadata?.first_name
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name ?? ""}`.trim()
        : user?.email ?? "System",
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId ?? null,
      resource_name: params.resourceName ?? null,
      old_values: params.oldValues ?? null,
      new_values: params.newValues ?? null,
      changed_fields: params.changedFields ?? null,
      metadata: params.metadata ?? null,
      affected_count: params.affectedCount ?? 1,
    });
  } catch (e) {
    console.warn("createAuditLogEntry: failed (non-critical)", e);
  }
}

/** Compute which fields changed between two records. */
function computeChangedFields(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
): string[] {
  const ignoreKeys = new Set(["updated_at", "last_seen", "created_at", "id"]);
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
  const changed: string[] = [];
  for (const key of allKeys) {
    if (ignoreKeys.has(key)) continue;
    if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
      changed.push(key);
    }
  }
  return changed;
}

/** Get a human-readable name from a record. */
function getRecordName(resource: string, record: Record<string, unknown>): string {
  if (resource === "contacts") {
    const first = record.first_name ?? "";
    const last = record.last_name ?? "";
    return `${first} ${last}`.trim() || `Kontakt #${record.id}`;
  }
  if (resource === "companies") return (record.name as string) || `Unternehmen #${record.id}`;
  if (resource === "deals") return (record.name as string) || `Deal #${record.id}`;
  return `${resource} #${record.id}`;
}

/**
 * Strip `_cf_*` keys from a record, store them aside, and return the cleaned record.
 */
function stripCustomFields<T extends Record<string, unknown>>(data: T): T {
  const cfEntries: Record<string, unknown> = {};
  const cleaned = { ...data };
  for (const key of Object.keys(cleaned)) {
    if (key.startsWith("_cf_")) {
      cfEntries[key] = cleaned[key];
      delete cleaned[key];
    }
  }
  if (Object.keys(cfEntries).length > 0) {
    // Store for afterSave — for updates we key by id, for creates we use a singleton
    if ((data as any).id) {
      pendingCustomFields.set(`${(data as any).id}`, cfEntries);
    } else {
      pendingCreateCfData = cfEntries;
    }
  }
  return cleaned;
}

/**
 * After a record is saved, persist any pending _cf_ values to custom_field_values.
 * Wrapped in try-catch so it fails gracefully if the tables don't exist yet.
 */
async function saveCustomFieldValues(
  record: Record<string, unknown>,
  dataProvider: DataProvider,
  entityIdField: "contact_id" | "company_id" | "deal_id",
) {
  const id = record.id as number;
  const cfData = pendingCustomFields.get(`${id}`) || pendingCreateCfData;
  if (!cfData || Object.keys(cfData).length === 0) {
    pendingCreateCfData = null;
    return record;
  }
  pendingCustomFields.delete(`${id}`);
  pendingCreateCfData = null;

  try {
  // Determine entity_type from entityIdField
  const entityType = entityIdField.replace("_id", "") === "contact" ? "contacts"
    : entityIdField.replace("_id", "") === "company" ? "companies" : "deals";

  // Load field definitions for this entity type
  const { data: fieldDefs } = await dataProvider.getList("custom_field_definitions", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "id", order: "ASC" },
    filter: { entity_type: entityType, "deleted_at@is": "null" },
  });

  if (!fieldDefs || fieldDefs.length === 0) return record;

  // Load existing custom field values for this record
  const { data: existingValues } = await dataProvider.getList("custom_field_values", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "id", order: "ASC" },
    filter: { [entityIdField]: id },
  });

  const existingByFieldId = new Map(
    (existingValues || []).map((v: any) => [v.field_definition_id, v]),
  );

  for (const fieldDef of fieldDefs) {
    const cfKey = `_cf_${fieldDef.name}`;
    if (!(cfKey in cfData)) continue;

    const value = cfData[cfKey];
    const existing = existingByFieldId.get(fieldDef.id);

    if (existing) {
      // Update existing value
      await dataProvider.update("custom_field_values", {
        id: existing.id,
        data: { value: value ?? null, updated_at: new Date().toISOString() },
        previousData: existing,
      });
    } else {
      // Create new value
      await dataProvider.create("custom_field_values", {
        data: {
          field_definition_id: fieldDef.id,
          [entityIdField]: id,
          value: value ?? null,
        },
      });
    }
  }
  } catch (e) {
    // Tables may not exist yet on remote — fail silently
    console.warn("saveCustomFieldValues: skipped (tables may not exist)", e);
  }

  return record;
}

/**
 * After reading a record, merge in its custom field values as _cf_* keys.
 * Wrapped in try-catch so it fails gracefully if the tables don't exist yet.
 */
async function mergeCustomFieldValues(
  record: Record<string, unknown>,
  dataProvider: DataProvider,
  entityIdField: "contact_id" | "company_id" | "deal_id",
) {
  const id = record.id as number;
  if (!id) return record;

  try {
  const entityType = entityIdField.replace("_id", "") === "contact" ? "contacts"
    : entityIdField.replace("_id", "") === "company" ? "companies" : "deals";

  // Load field definitions
  const { data: fieldDefs } = await dataProvider.getList("custom_field_definitions", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "id", order: "ASC" },
    filter: { entity_type: entityType, "deleted_at@is": "null" },
  });

  if (!fieldDefs || fieldDefs.length === 0) return record;

  // Load this record's custom field values
  const { data: values } = await dataProvider.getList("custom_field_values", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "id", order: "ASC" },
    filter: { [entityIdField]: id },
  });

  if (!values || values.length === 0) return record;

  const valueByFieldId = new Map(
    values.map((v: any) => [v.field_definition_id, v.value]),
  );

  for (const fieldDef of fieldDefs) {
    const val = valueByFieldId.get(fieldDef.id);
    if (val !== undefined) {
      (record as any)[`_cf_${fieldDef.name}`] = val;
    }
  }
  } catch (e) {
    // Tables may not exist yet on remote — fail silently
    console.warn("mergeCustomFieldValues: skipped (tables may not exist)", e);
  }

  return record;
}

if (import.meta.env.VITE_SUPABASE_URL === undefined) {
  throw new Error("Please set the VITE_SUPABASE_URL environment variable");
}
if (import.meta.env.VITE_SB_PUBLISHABLE_KEY === undefined) {
  throw new Error(
    "Please set the VITE_SB_PUBLISHABLE_KEY environment variable",
  );
}

const baseDataProvider = supabaseDataProvider({
  instanceUrl: import.meta.env.VITE_SUPABASE_URL,
  apiKey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
  supabaseClient: supabase,
  sortOrder: "asc,desc.nullslast" as any,
});

const processCompanyLogo = async (params: any) => {
  const logo = params.data.logo;

  if (logo?.rawFile instanceof File) {
    await uploadToBucket(logo);
  }

  return {
    ...params,
    data: {
      ...params.data,
      logo,
    },
  };
};

const dataProviderWithCustomMethods = {
  ...baseDataProvider,
  async getList(resource: string, params: GetListParams) {
    // Auto-filter soft-deleted records for soft-deletable resources
    const sdCfg = SOFT_DELETABLE_RESOURCES[resource];
    const filter = sdCfg
      ? { ...params.filter, [`${sdCfg.deletedAtFieldName}@is`]: "null" }
      : params.filter;
    const patchedParams = { ...params, filter };

    if (resource === "companies") {
      return baseDataProvider.getList("companies_summary", patchedParams);
    }
    if (resource === "contacts") {
      return baseDataProvider.getList("contacts_summary", patchedParams);
    }

    return baseDataProvider.getList(resource, patchedParams);
  },
  async getOne(resource: string, params: any) {
    if (resource === "companies") {
      return baseDataProvider.getOne("companies_summary", params);
    }
    if (resource === "contacts") {
      return baseDataProvider.getOne("contacts_summary", params);
    }

    return baseDataProvider.getOne(resource, params);
  },

  async signUp({ email, password, first_name, last_name }: SignUpData) {
    const response = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name,
          last_name,
        },
      },
    });

    if (!response.data?.user || response.error) {
      console.error("signUp.error", response.error);
      throw new Error(response?.error?.message || "Failed to create account");
    }

    // Update the is initialized cache
    getIsInitialized._is_initialized_cache = true;

    return {
      id: response.data.user.id,
      email,
      password,
    };
  },
  async salesCreate(body: SalesFormData) {
    const { data, error } = await supabase.functions.invoke<{ data: Sale }>(
      "users",
      {
        method: "POST",
        body,
      },
    );

    if (!data || error) {
      console.error("salesCreate.error", error);
      const errorDetails = await (async () => {
        try {
          return (await error?.context?.json()) ?? {};
        } catch {
          return {};
        }
      })();
      throw new Error(errorDetails?.message || "Failed to create the user");
    }

    return data.data;
  },
  async salesUpdate(
    id: Identifier,
    data: Partial<Omit<SalesFormData, "password">>,
  ) {
    const { email, first_name, last_name, administrator, avatar, disabled } =
      data;

    const { data: updatedData, error } = await supabase.functions.invoke<{
      data: Sale;
    }>("users", {
      method: "PATCH",
      body: {
        sales_id: id,
        email,
        first_name,
        last_name,
        administrator,
        disabled,
        avatar,
      },
    });

    if (!updatedData || error) {
      console.error("salesCreate.error", error);
      throw new Error("Failed to update account manager");
    }

    return updatedData.data;
  },
  async updatePassword(id: Identifier) {
    const { data: passwordUpdated, error } =
      await supabase.functions.invoke<boolean>("update_password", {
        method: "PATCH",
        body: {
          sales_id: id,
        },
      });

    if (!passwordUpdated || error) {
      console.error("update_password.error", error);
      throw new Error("Failed to update password");
    }

    return passwordUpdated;
  },
  async unarchiveDeal(deal: Deal) {
    // get all deals where stage is the same as the deal to unarchive
    const { data: deals } = await baseDataProvider.getList<Deal>("deals", {
      filter: { stage: deal.stage },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "index", order: "ASC" },
    });

    // set index for each deal starting from 1, if the deal to unarchive is found, set its index to the last one
    const updatedDeals = deals.map((d, index) => ({
      ...d,
      index: d.id === deal.id ? 0 : index + 1,
      archived_at: d.id === deal.id ? null : d.archived_at,
    }));

    return await Promise.all(
      updatedDeals.map((updatedDeal) =>
        baseDataProvider.update("deals", {
          id: updatedDeal.id,
          data: updatedDeal,
          previousData: deals.find((d) => d.id === updatedDeal.id),
        }),
      ),
    );
  },
  async getActivityLog(companyId?: Identifier) {
    return getActivityLog(baseDataProvider, companyId);
  },
  async isInitialized() {
    return getIsInitialized();
  },
  async mergeContacts(sourceId: Identifier, targetId: Identifier) {
    const { data, error } = await supabase.functions.invoke("merge_contacts", {
      method: "POST",
      body: { loserId: sourceId, winnerId: targetId },
    });

    if (error) {
      console.error("merge_contacts.error", error);
      throw new Error("Failed to merge contacts");
    }

    return data;
  },
  async getConfiguration(): Promise<ConfigurationContextValue> {
    const { data } = await baseDataProvider.getOne("configuration", { id: 1 });
    return (data?.config as ConfigurationContextValue) ?? {};
  },
  async updateConfiguration(
    config: ConfigurationContextValue,
  ): Promise<ConfigurationContextValue> {
    const { data } = await baseDataProvider.update("configuration", {
      id: 1,
      data: { config },
      previousData: { id: 1 },
    });
    return data.config as ConfigurationContextValue;
  },

  // ── EE: Soft Delete methods (addSoftDeleteInPlace-compatible) ──────
  async softDelete(resource: string, params: { id: Identifier; authorId?: Identifier; previousData?: any; meta?: any }) {
    const cfg = SOFT_DELETABLE_RESOURCES[resource];
    if (!cfg) throw new Error(`Resource "${resource}" does not support soft delete.`);

    let recordToDelete = params.previousData;
    if (!recordToDelete) {
      recordToDelete = (await baseDataProvider.getOne(resource, { id: params.id })).data;
    }

    const result = await baseDataProvider.update(resource, {
      id: params.id,
      data: { [cfg.deletedAtFieldName]: new Date().toISOString() },
      previousData: recordToDelete,
    });

    const deletedRecord: DeletedRecordType = {
      id: `${resource}:${params.id}`,
      resource,
      deleted_at: result.data[cfg.deletedAtFieldName],
      deleted_by: params.authorId ?? null,
      data: recordToDelete,
    };

    // Audit log
    createAuditLogEntry({
      action: "delete",
      resourceType: resource,
      resourceId: params.id as number,
      resourceName: getRecordName(resource, recordToDelete),
      oldValues: recordToDelete,
    });

    return { data: recordToDelete, deletedRecord };
  },

  async softDeleteMany(resource: string, params: { ids: Identifier[]; authorId?: Identifier; meta?: any }) {
    const cfg = SOFT_DELETABLE_RESOURCES[resource];
    if (!cfg) throw new Error(`Resource "${resource}" does not support soft delete.`);

    await Promise.all(
      params.ids.map((id) =>
        baseDataProvider.update(resource, {
          id,
          data: { [cfg.deletedAtFieldName]: new Date().toISOString() },
          previousData: { id },
        })
      )
    );

    const { data: records } = await baseDataProvider.getMany(resource, { ids: params.ids });
    const deletedRecords: DeletedRecordType[] = records.map((r: any) => ({
      id: `${resource}:${r.id}`,
      resource,
      deleted_at: r[cfg.deletedAtFieldName],
      deleted_by: params.authorId ?? null,
      data: r,
    }));

    return { data: params.ids, deletedRecords };
  },

  async getOneDeleted(params: { id: Identifier; meta?: any }) {
    const idStr = String(params.id);
    const sepIdx = idStr.lastIndexOf(":");
    const resource = idStr.slice(0, sepIdx);
    const recordId = idStr.slice(sepIdx + 1);
    const cfg = SOFT_DELETABLE_RESOURCES[resource];
    if (!cfg) throw new Error(`Invalid deleted record id: ${params.id}`);

    const result = await baseDataProvider.getOne(resource, { id: recordId });
    return {
      data: {
        id: idStr,
        resource,
        deleted_at: result.data[cfg.deletedAtFieldName],
        deleted_by: result.data.deleted_by ?? null,
        data: result.data,
      } as DeletedRecordType,
    };
  },

  async getListDeleted(params: any) {
    const resources = Object.keys(SOFT_DELETABLE_RESOURCES);
    const allDeleted: DeletedRecordType[] = [];

    // Fetch soft-deleted records from each resource
    for (const resource of resources) {
      const cfg = SOFT_DELETABLE_RESOURCES[resource];
      try {
        const { data } = await baseDataProvider.getList(resource, {
          pagination: { page: 1, perPage: 200 },
          sort: params?.sort ?? { field: cfg.deletedAtFieldName, order: "DESC" },
          filter: { ...params?.filter, [`${cfg.deletedAtFieldName}@not.is`]: "null" },
        });
        for (const record of data) {
          allDeleted.push({
            id: `${resource}:${record.id}`,
            resource,
            deleted_at: record[cfg.deletedAtFieldName],
            deleted_by: record.deleted_by ?? null,
            data: record,
          });
        }
      } catch {
        // Skip resources that may not support the query
      }
    }

    // Sort by deleted_at descending
    allDeleted.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());

    const page = params?.pagination?.page ?? 1;
    const perPage = params?.pagination?.perPage ?? 25;
    const start = (page - 1) * perPage;
    return {
      data: allDeleted.slice(start, start + perPage),
      total: allDeleted.length,
    };
  },

  async restoreOne(params: { id: Identifier; meta?: any }) {
    const idStr = String(params.id);
    const sepIdx = idStr.lastIndexOf(":");
    const resource = idStr.slice(0, sepIdx);
    const recordId = idStr.slice(sepIdx + 1);
    const cfg = SOFT_DELETABLE_RESOURCES[resource];
    if (!cfg) throw new Error(`Invalid deleted record id: ${params.id}`);

    const recordBefore = (await baseDataProvider.getOne(resource, { id: recordId })).data;
    await baseDataProvider.update(resource, {
      id: recordId,
      data: { [cfg.deletedAtFieldName]: null },
      previousData: recordBefore,
    });

    createAuditLogEntry({
      action: "restore",
      resourceType: resource,
      resourceId: recordId as unknown as number,
      resourceName: getRecordName(resource, recordBefore),
    });

    return {
      data: {
        id: idStr,
        resource,
        deleted_at: recordBefore[cfg.deletedAtFieldName],
        deleted_by: recordBefore.deleted_by ?? null,
        data: recordBefore,
      } as DeletedRecordType,
    };
  },

  async restoreMany(params: { ids: Identifier[]; meta?: any }) {
    const idsByResource: Record<string, string[]> = {};
    for (const id of params.ids) {
      const idStr = String(id);
      const sepIdx = idStr.lastIndexOf(":");
      const resource = idStr.slice(0, sepIdx);
      const recordId = idStr.slice(sepIdx + 1);
      (idsByResource[resource] ??= []).push(recordId);
    }

    const restored: DeletedRecordType[] = [];
    for (const [resource, recordIds] of Object.entries(idsByResource)) {
      const cfg = SOFT_DELETABLE_RESOURCES[resource];
      if (!cfg) continue;
      const { data: records } = await baseDataProvider.getMany(resource, { ids: recordIds });
      for (const r of records) {
        restored.push({
          id: `${resource}:${r.id}`,
          resource,
          deleted_at: r[cfg.deletedAtFieldName],
          deleted_by: r.deleted_by ?? null,
          data: r,
        });
      }
      await Promise.all(
        recordIds.map((id) =>
          baseDataProvider.update(resource, {
            id,
            data: { [cfg.deletedAtFieldName]: null },
            previousData: { id },
          })
        )
      );
    }

    return { data: restored };
  },

  async hardDelete(params: { id: Identifier; previousData?: any; meta?: any }) {
    const idStr = String(params.id);
    const sepIdx = idStr.lastIndexOf(":");
    const resource = idStr.slice(0, sepIdx);
    const recordId = idStr.slice(sepIdx + 1);

    const result = await baseDataProvider.delete(resource, { id: recordId, previousData: params.previousData });
    return {
      data: {
        id: idStr,
        resource,
        deleted_at: result.data?.[SOFT_DELETABLE_RESOURCES[resource]?.deletedAtFieldName] ?? null,
        deleted_by: null,
        data: result.data,
      } as DeletedRecordType,
    };
  },

  async hardDeleteMany(params: { ids: Identifier[]; meta?: any }) {
    const idsByResource: Record<string, string[]> = {};
    for (const id of params.ids) {
      const idStr = String(id);
      const sepIdx = idStr.lastIndexOf(":");
      const resource = idStr.slice(0, sepIdx);
      const recordId = idStr.slice(sepIdx + 1);
      (idsByResource[resource] ??= []).push(recordId);
    }

    for (const [resource, recordIds] of Object.entries(idsByResource)) {
      await baseDataProvider.deleteMany(resource, { ids: recordIds });
    }

    return { data: params.ids, meta: [] };
  },

  // ── EE: Revision / History methods ─────────────────────────────────
  async getRevisions(resource: string, params: { recordId: Identifier }) {
    const { data } = await baseDataProvider.getList("record_versions", {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "created_at", order: "DESC" },
      filter: { resource_type: resource, resource_id: params.recordId },
    });

    // Map our DB schema → EE RecordRevision shape
    return {
      data: data.map((row: any): RecordRevision => ({
        id: row.id,
        resource,
        recordId: row.resource_id,
        date: row.created_at,
        message: row.change_summary ?? "",
        authorId: row.created_by,
        data: row.data,
      })),
      total: data.length,
    };
  },

  async addRevision(resource: string, params: {
    recordId: Identifier;
    data: any;
    authorId?: Identifier;
    message?: string;
    description?: string;
  }) {
    // Determine next version number
    const { data: existing } = await baseDataProvider.getList("record_versions", {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "version_number", order: "DESC" },
      filter: { resource_type: resource, resource_id: params.recordId },
    });
    const nextVersion = existing.length > 0 ? (existing[0] as any).version_number + 1 : 1;

    const { data: { user } } = await supabase.auth.getUser();

    const result = await baseDataProvider.create("record_versions", {
      data: {
        resource_type: resource,
        resource_id: params.recordId,
        version_number: nextVersion,
        data: params.data,
        change_summary: params.message ?? params.description ?? null,
        created_by: params.authorId ?? user?.id ?? null,
        created_by_email: user?.email ?? null,
      },
    });

    return {
      data: {
        id: result.data.id,
        resource,
        recordId: params.recordId,
        date: result.data.created_at,
        message: params.message ?? "",
        authorId: params.authorId ?? user?.id ?? null,
        data: params.data,
      } as RecordRevision,
    };
  },

  async deleteRevisions(resource: string, params: { recordId: Identifier }) {
    const { data: existing } = await baseDataProvider.getList("record_versions", {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
      filter: { resource_type: resource, resource_id: params.recordId },
    });

    if (existing.length > 0) {
      await baseDataProvider.deleteMany("record_versions", {
        ids: existing.map((r: any) => r.id),
      });
    }

    return { data: existing.map((r: any) => r.id) };
  },
} satisfies DataProvider & Partial<SoftDeleteDataProvider>;

export type CrmDataProvider = typeof dataProviderWithCustomMethods;

const processConfigLogo = async (logo: any): Promise<string> => {
  if (typeof logo === "string") return logo;
  if (logo?.rawFile instanceof File) {
    await uploadToBucket(logo);
    return logo.src;
  }
  return logo?.src ?? "";
};

const lifeCycleCallbacks: ResourceCallbacks[] = [
  {
    resource: "configuration",
    beforeUpdate: async (params) => {
      const config = params.data.config;
      if (config) {
        config.lightModeLogo = await processConfigLogo(config.lightModeLogo);
        config.darkModeLogo = await processConfigLogo(config.darkModeLogo);
      }
      return params;
    },
  },
  {
    resource: "contact_notes",
    beforeSave: async (data: ContactNote, _, __) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi) => uploadToBucket(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "deal_notes",
    beforeSave: async (data: DealNote, _, __) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi) => uploadToBucket(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "sales",
    beforeSave: async (data: Sale, _, __) => {
      if (data.avatar) {
        await uploadToBucket(data.avatar);
      }
      return data;
    },
  },
  {
    resource: "contacts",
    beforeSave: async (data: any) => stripCustomFields(data),
    afterSave: async (record: any, dataProvider: DataProvider) => {
      return saveCustomFieldValues(record, dataProvider, "contact_id");
    },
    afterRead: async (record: any, dataProvider: DataProvider) => {
      return mergeCustomFieldValues(record, dataProvider, "contact_id");
    },
    afterCreate: async (result: any) => {
      createAuditLogEntry({
        action: "create",
        resourceType: "contacts",
        resourceId: result.data?.id,
        resourceName: getRecordName("contacts", result.data ?? {}),
        newValues: result.data,
      });
      return result;
    },
    afterUpdate: async (result: any, params: any) => {
      const changedFields = params.previousData
        ? computeChangedFields(params.previousData, result.data ?? {})
        : null;
      createAuditLogEntry({
        action: "update",
        resourceType: "contacts",
        resourceId: result.data?.id,
        resourceName: getRecordName("contacts", result.data ?? {}),
        oldValues: params.previousData ?? null,
        newValues: result.data,
        changedFields,
      });
      return result;
    },
    afterDelete: async (result: any) => {
      createAuditLogEntry({
        action: "delete",
        resourceType: "contacts",
        resourceId: result.data?.id,
        resourceName: getRecordName("contacts", result.data ?? {}),
        oldValues: result.data,
      });
      return result;
    },
    beforeGetList: async (params) => {
      return applyFullTextSearch([
        "first_name",
        "last_name",
        "company_name",
        "title",
        "email",
        "phone",
        "background",
      ])(params);
    },
  },
  {
    resource: "companies",
    beforeSave: async (data: any) => stripCustomFields(data),
    afterSave: async (record: any, dataProvider: DataProvider) => {
      return saveCustomFieldValues(record, dataProvider, "company_id");
    },
    afterRead: async (record: any, dataProvider: DataProvider) => {
      return mergeCustomFieldValues(record, dataProvider, "company_id");
    },
    afterCreate: async (result: any) => {
      createAuditLogEntry({
        action: "create",
        resourceType: "companies",
        resourceId: result.data?.id,
        resourceName: getRecordName("companies", result.data ?? {}),
        newValues: result.data,
      });
      return result;
    },
    afterUpdate: async (result: any, params: any) => {
      const changedFields = params.previousData
        ? computeChangedFields(params.previousData, result.data ?? {})
        : null;
      createAuditLogEntry({
        action: "update",
        resourceType: "companies",
        resourceId: result.data?.id,
        resourceName: getRecordName("companies", result.data ?? {}),
        oldValues: params.previousData ?? null,
        newValues: result.data,
        changedFields,
      });
      return result;
    },
    afterDelete: async (result: any) => {
      createAuditLogEntry({
        action: "delete",
        resourceType: "companies",
        resourceId: result.data?.id,
        resourceName: getRecordName("companies", result.data ?? {}),
        oldValues: result.data,
      });
      return result;
    },
    beforeGetList: async (params) => {
      return applyFullTextSearch([
        "name",
        "phone_number",
        "website",
        "zipcode",
        "city",
        "state_abbr",
      ])(params);
    },
    beforeCreate: async (params) => {
      const createParams = await processCompanyLogo(params);

      return {
        ...createParams,
        data: {
          created_at: new Date().toISOString(),
          ...createParams.data,
        },
      };
    },
    beforeUpdate: async (params) => {
      return await processCompanyLogo(params);
    },
  },
  {
    resource: "contacts_summary",
    beforeGetList: async (params) => {
      return applyFullTextSearch(["first_name", "last_name"])(params);
    },
  },
  {
    resource: "deals",
    beforeSave: async (data: any) => stripCustomFields(data),
    afterSave: async (record: any, dataProvider: DataProvider) => {
      return saveCustomFieldValues(record, dataProvider, "deal_id");
    },
    afterRead: async (record: any, dataProvider: DataProvider) => {
      return mergeCustomFieldValues(record, dataProvider, "deal_id");
    },
    afterCreate: async (result: any) => {
      createAuditLogEntry({
        action: "create",
        resourceType: "deals",
        resourceId: result.data?.id,
        resourceName: getRecordName("deals", result.data ?? {}),
        newValues: result.data,
      });
      return result;
    },
    afterUpdate: async (result: any, params: any) => {
      const changedFields = params.previousData
        ? computeChangedFields(params.previousData, result.data ?? {})
        : null;
      createAuditLogEntry({
        action: "update",
        resourceType: "deals",
        resourceId: result.data?.id,
        resourceName: getRecordName("deals", result.data ?? {}),
        oldValues: params.previousData ?? null,
        newValues: result.data,
        changedFields,
      });
      return result;
    },
    afterDelete: async (result: any) => {
      createAuditLogEntry({
        action: "delete",
        resourceType: "deals",
        resourceId: result.data?.id,
        resourceName: getRecordName("deals", result.data ?? {}),
        oldValues: result.data,
      });
      return result;
    },
    beforeGetList: async (params) => {
      return applyFullTextSearch(["name", "category", "description"])(params);
    },
  },
];

// ── Apply lifecycle callbacks ─────────────────────────────────────────
const dataProviderWithCallbacks = withLifecycleCallbacks(
  dataProviderWithCustomMethods,
  lifeCycleCallbacks,
);

// ── Layer 1: Add Supabase Realtime (subscribe/unsubscribe/publish) ────
const dataProviderWithRealtime = addRealTimeMethodsBasedOnSupabase({
  dataProvider: dataProviderWithCallbacks,
  supabaseClient: supabase,
});

// ── Layer 2: Add global search method ─────────────────────────────────
const dataProviderWithSearch = addSearchMethod(dataProviderWithRealtime, {
  contacts: {
    label: (record: any) =>
      `${record.first_name ?? ""} ${record.last_name ?? ""}`.trim() || `Kontakt #${record.id}`,
    description: (record: any) =>
      [record.email_jsonb?.[0]?.email, record.company_name].filter(Boolean).join(" – "),
  },
  companies: {
    label: "name",
    description: (record: any) =>
      [record.sector, record.city].filter(Boolean).join(", "),
  },
  deals: {
    label: "name",
    description: (record: any) =>
      [record.category, record.stage, record.amount ? `€${record.amount}` : null].filter(Boolean).join(" – "),
  },
});

// ── Layer 3: Add tree methods (parent_id + position based) ────────────
// Note: addTreeMethodsBasedOnParentAndPosition does NOT spread the base
// data provider — it returns only tree methods. We merge manually.
const treeMethods = addTreeMethodsBasedOnParentAndPosition({
  dataProvider: dataProviderWithSearch,
  parentIdField: "parent_id",
  positionField: "position",
}) as any;

// ── Re-attach custom methods lost during wrapping ─────────────────────
export const dataProvider = {
  // Core data provider methods (from search wrapper, which includes realtime + lifecycle)
  ...dataProviderWithSearch,
  // Tree methods (getTree, getRootNodes, addChildNode, etc.)
  ...treeMethods,
  // Custom CRM methods
  signUp: dataProviderWithCustomMethods.signUp,
  salesCreate: dataProviderWithCustomMethods.salesCreate,
  salesUpdate: dataProviderWithCustomMethods.salesUpdate,
  updatePassword: dataProviderWithCustomMethods.updatePassword,
  unarchiveDeal: dataProviderWithCustomMethods.unarchiveDeal,
  getActivityLog: dataProviderWithCustomMethods.getActivityLog,
  isInitialized: dataProviderWithCustomMethods.isInitialized,
  mergeContacts: dataProviderWithCustomMethods.mergeContacts,
  getConfiguration: dataProviderWithCustomMethods.getConfiguration,
  updateConfiguration: dataProviderWithCustomMethods.updateConfiguration,
  // Soft-delete methods
  softDelete: dataProviderWithCustomMethods.softDelete,
  softDeleteMany: dataProviderWithCustomMethods.softDeleteMany,
  getOneDeleted: dataProviderWithCustomMethods.getOneDeleted,
  getListDeleted: dataProviderWithCustomMethods.getListDeleted,
  restoreOne: dataProviderWithCustomMethods.restoreOne,
  restoreMany: dataProviderWithCustomMethods.restoreMany,
  hardDelete: dataProviderWithCustomMethods.hardDelete,
  hardDeleteMany: dataProviderWithCustomMethods.hardDeleteMany,
  // Revision / History methods
  getRevisions: dataProviderWithCustomMethods.getRevisions,
  addRevision: dataProviderWithCustomMethods.addRevision,
  deleteRevisions: dataProviderWithCustomMethods.deleteRevisions,
} as CrmDataProvider;

const applyFullTextSearch = (columns: string[]) => (params: GetListParams) => {
  if (!params.filter?.q) {
    return params;
  }
  const { q, ...filter } = params.filter;
  return {
    ...params,
    filter: {
      ...filter,
      "@or": columns.reduce((acc, column) => {
        if (column === "email")
          return {
            ...acc,
            [`email_fts@ilike`]: q,
          };
        if (column === "phone")
          return {
            ...acc,
            [`phone_fts@ilike`]: q,
          };
        else
          return {
            ...acc,
            [`${column}@ilike`]: q,
          };
      }, {}),
    },
  };
};

const uploadToBucket = async (fi: RAFile) => {
  if (!fi.src.startsWith("blob:") && !fi.src.startsWith("data:")) {
    // Sign URL check if path exists in the bucket
    if (fi.path) {
      const { error } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .createSignedUrl(fi.path, 60);

      if (!error) {
        return fi;
      }
    }
  }

  const dataContent = fi.src
    ? await fetch(fi.src)
        .then((res) => {
          if (res.status !== 200) {
            return null;
          }
          return res.blob();
        })
        .catch(() => null)
    : fi.rawFile;

  if (dataContent == null) {
    // We weren't able to download the file from its src (e.g. user must be signed in on another website to access it)
    // or the file has no content (not probable)
    // In that case, just return it as is: when trying to download it, users should be redirected to the other website
    // and see they need to be signed in. It will then be their responsibility to upload the file back to the note.
    return fi;
  }

  const file = fi.rawFile;
  const fileParts = file.name.split(".");
  const fileExt = fileParts.length > 1 ? `.${file.name.split(".").pop()}` : "";
  const fileName = `${Math.random()}${fileExt}`;
  const filePath = `${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(filePath, dataContent);

  if (uploadError) {
    console.error("uploadError", uploadError);
    throw new Error("Failed to upload attachment");
  }

  const { data } = supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .getPublicUrl(filePath);

  fi.path = filePath;
  fi.src = data.publicUrl;

  // save MIME type
  const mimeType = file.type;
  fi.type = mimeType;

  return fi;
};
