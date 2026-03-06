import type { AuthProvider } from "ra-core";
import { supabaseAuthProvider } from "ra-supabase-core";
import {
  canAccessWithPermissions,
  getPermissionsFromRoles,
  type Permission,
  type RoleDefinitions,
} from "@react-admin/ra-core-ee";

import { supabase } from "./supabase";

// ── Fallback role definitions (used when DB roles cannot be loaded) ────
const fallbackRoleDefinitions: RoleDefinitions = {
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

// ── Dynamic role loading from DB ──────────────────────────────────────

const DB_ROLES_CACHE_KEY = "RaStore.auth.db_roles_v2";
const DB_ROLES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedDbRoles {
  roleDefinitions: RoleDefinitions;
  userRoles: string[];
  timestamp: number;
}

// Admin-only resources: non-admin roles get explicit deny entries
const ADMIN_ONLY_RESOURCES = [
  "sales", "configuration", "roles", "role_permissions",
  "teams", "team_members", "user_roles", "team_roles",
  "attribute_definitions", "user_attributes", "permission_conditions",
];

/**
 * Convert a role_permissions action string to the ra-rbac action array.
 * DB stores '*' or comma-separated actions like 'list,show,create'.
 */
function parseActions(action: string): string | string[] {
  if (action === "*") return "*";
  return action.split(",").map((a) => a.trim());
}

/**
 * Load role definitions and user roles from the database.
 * Falls back to static definitions on error.
 */
async function loadDbRoles(salesId: number, isAdministrator: boolean): Promise<{
  roleDefinitions: RoleDefinitions;
  userRoles: string[];
}> {
  // Check cache first
  const storage = getLocalStorage();
  const cached = storage?.getItem(DB_ROLES_CACHE_KEY);
  if (cached) {
    try {
      const parsed: CachedDbRoles = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < DB_ROLES_CACHE_TTL) {
        return { roleDefinitions: parsed.roleDefinitions, userRoles: parsed.userRoles };
      }
    } catch { /* cache invalid, continue */ }
  }

  try {
    // 1. Load all roles
    const { data: roles, error: rolesErr } = await supabase
      .from("roles")
      .select("id, name");
    if (rolesErr || !roles?.length) throw new Error("Failed to load roles");

    // 2. Load all role_permissions
    const { data: perms, error: permsErr } = await supabase
      .from("role_permissions")
      .select("role_id, resource, action, scope");
    if (permsErr) throw new Error("Failed to load permissions");

    // 3. Load user's direct roles
    const { data: userRolesData } = await supabase
      .from("user_roles")
      .select("role_id")
      .eq("sales_id", salesId);

    // 4. Load user's team roles
    const { data: teamRolesData } = await supabase
      .from("team_roles")
      .select("role_id, team_id!inner(id)")
      .in(
        "team_id",
        // Get team IDs for the current user
        (await supabase
          .from("team_members")
          .select("team_id")
          .eq("sales_id", salesId)
        ).data?.map((tm) => tm.team_id) || [],
      );

    // 5. Build roleDefinitions from DB
    const dbRoleDefinitions: RoleDefinitions = {};
    const roleMap = new Map(roles.map((r) => [r.id, r.name]));

    for (const role of roles) {
      const rolePerms = (perms || []).filter((p) => p.role_id === role.id);
      const permissions: Permission[] = [];

      for (const perm of rolePerms) {
        if (perm.resource === "*" && perm.action === "*") {
          // Wildcard admin
          permissions.push({ resource: "*", action: "*" });
        } else {
          permissions.push({
            resource: perm.resource,
            action: parseActions(perm.action),
          });
        }
      }

      // Non-admin roles get deny entries for admin-only resources
      const isAdminRole = rolePerms.some((p) => p.resource === "*" && p.action === "*");
      if (!isAdminRole) {
        for (const res of ADMIN_ONLY_RESOURCES) {
          permissions.push({ type: "deny", resource: res, action: "*" });
        }
        // Also add read-only access to metadata tables for non-admin roles
        const metadataResources = [
          "audit_logs", "record_versions", "custom_object_definitions",
          "custom_field_definitions", "object_relationships", "relationship_definitions",
        ];
        const hasMetaAccess = rolePerms.some((p) => metadataResources.includes(p.resource));
        if (!hasMetaAccess) {
          for (const res of metadataResources) {
            permissions.push({ resource: res, action: ["list", "show"] });
          }
          // Custom field editing for regular users
          permissions.push({ resource: "custom_field_values", action: ["list", "show", "create", "edit"] });
          permissions.push({ resource: "custom_object_data", action: ["list", "show", "create", "edit", "delete"] });
        }
      }

      dbRoleDefinitions[role.name] = permissions;
    }

    // 6. Determine user's role names
    const userRoleIds = new Set<number>();
    for (const ur of userRolesData || []) {
      userRoleIds.add(ur.role_id);
    }
    for (const tr of teamRolesData || []) {
      userRoleIds.add(tr.role_id);
    }

    // If administrator flag is set, ensure admin role is included
    if (isAdministrator) {
      const adminRole = roles.find((r) => r.name === "admin");
      if (adminRole) userRoleIds.add(adminRole.id);
    }

    const userRoles = Array.from(userRoleIds)
      .map((id) => roleMap.get(id))
      .filter((name): name is string => !!name);

    // If the user has an admin role (wildcard */*), use ONLY the admin role.
    // This prevents deny entries from other roles overriding admin access.
    const adminRoleName = roles.find((r) => {
      const rPerms = (perms || []).filter((p) => p.role_id === r.id);
      return rPerms.some((p) => p.resource === "*" && p.action === "*");
    })?.name;
    const effectiveUserRoles = adminRoleName && userRoles.includes(adminRoleName)
      ? [adminRoleName]
      : userRoles;

    // Fallback: if no roles assigned, use default "user" role
    if (effectiveUserRoles.length === 0) {
      return {
        roleDefinitions: fallbackRoleDefinitions,
        userRoles: [isAdministrator ? "admin" : "user"],
      };
    }

    // Cache the result
    const cacheData: CachedDbRoles = {
      roleDefinitions: dbRoleDefinitions,
      userRoles: effectiveUserRoles,
      timestamp: Date.now(),
    };
    storage?.setItem(DB_ROLES_CACHE_KEY, JSON.stringify(cacheData));

    return { roleDefinitions: dbRoleDefinitions, userRoles: effectiveUserRoles };
  } catch {
    // Fallback to static definitions on any error
    console.warn("[authProvider] Failed to load DB roles, using fallback");
    return {
      roleDefinitions: fallbackRoleDefinitions,
      userRoles: [isAdministrator ? "admin" : "user"],
    };
  }
}

// Export for compatibility (used by other modules that import roleDefinitions)
export const roleDefinitions = fallbackRoleDefinitions;

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
  storage?.removeItem(DB_ROLES_CACHE_KEY);
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

    // Load dynamic role definitions from DB (with cache + fallback)
    const { roleDefinitions: dynRoles, userRoles } = await loadDbRoles(
      sale.id,
      !!sale.administrator,
    );

    const permissions = getPermissionsFromRoles({
      roleDefinitions: dynRoles,
      userRoles,
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

    const { roleDefinitions: dynRoles, userRoles } = await loadDbRoles(
      sale.id,
      !!sale.administrator,
    );

    return getPermissionsFromRoles({
      roleDefinitions: dynRoles,
      userRoles,
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
