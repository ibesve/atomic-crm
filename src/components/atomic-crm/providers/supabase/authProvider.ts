import type { AuthProvider } from "ra-core";
import { supabaseAuthProvider } from "ra-supabase-core";
import {
  canAccessWithPermissions,
  getPermissionsFromRoles,
  type Permission,
  type RoleDefinitions,
} from "@react-admin/ra-core-ee";

import { supabase } from "./supabase";

// ── Role definitions for ra-rbac ──────────────────────────────────────
const roleDefinitions: RoleDefinitions = {
  admin: [
    { resource: "*", action: "*" },
  ],
  user: [
    { resource: "contacts", action: ["list", "show", "create", "edit", "delete", "export"] },
    { resource: "companies", action: ["list", "show", "create", "edit", "delete", "export"] },
    { resource: "deals", action: ["list", "show", "create", "edit", "delete", "export"] },
    { resource: "tasks", action: ["list", "show", "create", "edit", "delete"] },
    { resource: "contact_notes", action: ["list", "show", "create", "edit", "delete"] },
    { resource: "deal_notes", action: ["list", "show", "create", "edit", "delete"] },
    { resource: "tags", action: ["list", "show", "create", "edit", "delete"] },
    { resource: "audit_logs", action: ["list", "show"] },
    { resource: "record_versions", action: ["list", "show"] },
    { resource: "custom_object_definitions", action: ["list", "show"] },
    { resource: "custom_field_definitions", action: ["list", "show"] },
    { resource: "custom_field_values", action: ["list", "show", "create", "edit"] },
    { resource: "custom_object_data", action: ["list", "show", "create", "edit", "delete"] },
    { resource: "object_relationships", action: ["list", "show"] },
    { resource: "relationship_definitions", action: ["list", "show"] },
    // Explicitly deny admin-only resources
    { type: "deny", resource: "sales", action: "*" },
    { type: "deny", resource: "configuration", action: "*" },
    { type: "deny", resource: "roles", action: "*" },
    { type: "deny", resource: "role_permissions", action: "*" },
    { type: "deny", resource: "teams", action: "*" },
    { type: "deny", resource: "team_members", action: "*" },
    { type: "deny", resource: "user_roles", action: "*" },
    { type: "deny", resource: "team_roles", action: "*" },
    { type: "deny", resource: "attribute_definitions", action: "*" },
    { type: "deny", resource: "user_attributes", action: "*" },
    { type: "deny", resource: "permission_conditions", action: "*" },
  ],
};

export { roleDefinitions };

const baseAuthProvider = supabaseAuthProvider(supabase, {
  getIdentity: async () => {
    const sale = await getSale();

    if (sale == null) {
      throw new Error();
    }

    return {
      id: sale.id,
      fullName: `${sale.first_name} ${sale.last_name}`,
      avatar: sale.avatar?.src,
      administrator: sale.administrator, // Administrator-Flag hinzufügen
    };
  },
});

// To speed up checks, we cache the initialization state
// and the current sale in the local storage. They are cleared on logout.
const IS_INITIALIZED_CACHE_KEY = "RaStore.auth.is_initialized";
const CURRENT_SALE_CACHE_KEY = "RaStore.auth.current_sale";

function getLocalStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export async function getIsInitialized() {
  const storage = getLocalStorage();
  const cachedValue = storage?.getItem(IS_INITIALIZED_CACHE_KEY);
  if (cachedValue != null) {
    return cachedValue === "true";
  }

  const { data } = await supabase.from("init_state").select("is_initialized");
  const isInitialized = data?.at(0)?.is_initialized > 0;

  if (isInitialized) {
    storage?.setItem(IS_INITIALIZED_CACHE_KEY, "true");
  }

  return isInitialized;
}

const getSale = async () => {
  const storage = getLocalStorage();
  const cachedValue = storage?.getItem(CURRENT_SALE_CACHE_KEY);
  if (cachedValue != null) {
    return JSON.parse(cachedValue);
  }

  const { data: dataSession, error: errorSession } =
    await supabase.auth.getSession();

  // Shouldn't happen after login but just in case
  if (dataSession?.session?.user == null || errorSession) {
    return undefined;
  }

  const { data: dataSale, error: errorSale } = await supabase
    .from("sales")
    .select("id, first_name, last_name, avatar, administrator")
    .match({ user_id: dataSession?.session?.user.id })
    .single();

  // Shouldn't happen either as all users are sales but just in case
  if (dataSale == null || errorSale) {
    return undefined;
  }

  storage?.setItem(CURRENT_SALE_CACHE_KEY, JSON.stringify(dataSale));
  return dataSale;
};

function clearCache() {
  const storage = getLocalStorage();
  storage?.removeItem(IS_INITIALIZED_CACHE_KEY);
  storage?.removeItem(CURRENT_SALE_CACHE_KEY);
}

export const authProvider: AuthProvider = {
  ...baseAuthProvider,
  login: async (params) => {
    if (params.ssoDomain) {
      const { error } = await supabase.auth.signInWithSSO({
        domain: params.ssoDomain,
      });
      if (error) {
        throw error;
      }
      return;
    }
    return baseAuthProvider.login(params);
  },
  logout: async (params) => {
    clearCache();
    return baseAuthProvider.logout(params);
  },
  checkAuth: async (params) => {
    // Users are on the set-password page, nothing to do
    if (
      window.location.pathname === "/set-password" ||
      window.location.hash.includes("#/set-password")
    ) {
      return;
    }
    // Users are on the forgot-password page, nothing to do
    if (
      window.location.pathname === "/forgot-password" ||
      window.location.hash.includes("#/forgot-password")
    ) {
      return;
    }
    // Users are on the sign-up page, nothing to do
    if (
      window.location.pathname === "/sign-up" ||
      window.location.hash.includes("#/sign-up")
    ) {
      return;
    }

    const isInitialized = await getIsInitialized();

    if (!isInitialized) {
      await supabase.auth.signOut();
      throw {
        redirectTo: "/sign-up",
        message: false,
      };
    }

    return baseAuthProvider.checkAuth(params);
  },
  canAccess: async (params) => {
    const isInitialized = await getIsInitialized();
    if (!isInitialized) return false;

    // Get the current user
    const sale = await getSale();
    if (sale == null) return false;

    // Compute permissions from role definitions using ra-rbac
    const role = sale.administrator ? "admin" : "user";
    const permissions = getPermissionsFromRoles({
      roleDefinitions,
      userRoles: [role],
    });

    return canAccessWithPermissions({
      permissions,
      action: params.action,
      resource: params.resource,
      record: params.record,
    });
  },
  getPermissions: async () => {
    const sale = await getSale();
    if (sale == null) return [];

    const role = sale.administrator ? "admin" : "user";
    return getPermissionsFromRoles({
      roleDefinitions,
      userRoles: [role],
    });
  },
  getAuthorizationDetails(authorizationId: string) {
    return supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  },
  approveAuthorization(authorizationId: string) {
    return supabase.auth.oauth.approveAuthorization(authorizationId);
  },
  denyAuthorization(authorizationId: string) {
    return supabase.auth.oauth.denyAuthorization(authorizationId);
  },
};
