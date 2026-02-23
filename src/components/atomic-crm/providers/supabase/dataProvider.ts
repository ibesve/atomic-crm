import { supabaseDataProvider } from "ra-supabase-core";
import {
  withLifecycleCallbacks,
  type DataProvider,
  type GetListParams,
  type Identifier,
  type ResourceCallbacks,
} from "ra-core";
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
import { getIsInitialized } from "./authProvider";
import { supabase } from "./supabase";

// ── Custom Field helpers ──────────────────────────────────────────────
// Temporary storage for _cf_ values stripped in beforeSave,
// keyed by `${resource}_${recordId}` or a unique token for creates.
const pendingCustomFields = new Map<string, Record<string, unknown>>();
let pendingCreateCfData: Record<string, unknown> | null = null;

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
    if (resource === "companies") {
      return baseDataProvider.getList("companies_summary", params);
    }
    if (resource === "contacts") {
      return baseDataProvider.getList("contacts_summary", params);
    }

    return baseDataProvider.getList(resource, params);
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
} satisfies DataProvider;

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
    beforeGetList: async (params) => {
      return applyFullTextSearch(["name", "category", "description"])(params);
    },
  },
];

export const dataProvider = withLifecycleCallbacks(
  dataProviderWithCustomMethods,
  lifeCycleCallbacks,
) as CrmDataProvider;

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
        .from("attachments")
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
    .from("attachments")
    .upload(filePath, dataContent);

  if (uploadError) {
    console.error("uploadError", uploadError);
    throw new Error("Failed to upload attachment");
  }

  const { data } = supabase.storage.from("attachments").getPublicUrl(filePath);

  fi.path = filePath;
  fi.src = data.publicUrl;

  // save MIME type
  const mimeType = file.type;
  fi.type = mimeType;

  return fi;
};
