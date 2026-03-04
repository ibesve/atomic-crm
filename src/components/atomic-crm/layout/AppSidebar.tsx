import {
  BarChart3,
  Building2,
  Contact,
  Handshake,
  Import,
  Link2,
  Settings,
  Shield,
  Table,
  User,
  Users,
  History,
  Box,
} from "lucide-react";
import {
  CanAccess,
  useGetIdentity,
  useGetList,
  useTranslate,
} from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import { RefreshButton } from "@/components/admin/refresh-button";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { CustomObjectDefinition } from "../types/custom-objects";

export const AppSidebar = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const location = useLocation();
  const translate = useTranslate();
  const { identity } = useGetIdentity();

  // Load custom object definitions for dynamic menu items
  const { data: customObjects } = useGetList<CustomObjectDefinition>(
    "custom_object_definitions",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "name", order: "ASC" },
    },
  );

  const isActive = (path: string | string[]) => {
    const paths = Array.isArray(path) ? path : [path];
    return paths.some((p) => {
      if (p === "/") return location.pathname === "/";
      return matchPath(`${p}/*`, location.pathname) != null || location.pathname === p;
    });
  };

  return (
    <Sidebar collapsible="icon">
      {/* Logo & Title */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link
                to="/"
                className="flex items-center gap-2 no-underline"
              >
                <div className="flex aspect-square size-8 items-center justify-center">
                  <img
                    className="[.light_&]:hidden h-6"
                    src={darkModeLogo}
                    alt={title}
                  />
                  <img
                    className="[.dark_&]:hidden h-6"
                    src={lightModeLogo}
                    alt={title}
                  />
                </div>
                <span className="font-semibold truncate">{title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>
            {translate("crm.navigation", { _: "Navigation" })}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/")}
                  tooltip={translate("crm.dashboard")}
                >
                  <Link to="/">
                    <BarChart3 />
                    <span>{translate("crm.dashboard")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* CRM Objects */}
        <SidebarGroup>
          <SidebarGroupLabel>
            {translate("crm.objects", { _: "Objekte" })}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(["/contacts", "/contacts-quickview"])}
                  tooltip={translate("crm.contacts")}
                >
                  <Link to="/contacts">
                    <Contact />
                    <span>{translate("crm.contacts")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/contacts-quickview")}
                  tooltip={translate("crm.contacts_quickview", { _: "Kontakte (Quickview)" })}
                >
                  <Link to="/contacts-quickview">
                    <Table />
                    <span>{translate("crm.contacts_quickview", { _: "Kontakte (Quickview)" })}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(["/companies", "/companies-quickview"])}
                  tooltip={translate("crm.companies")}
                >
                  <Link to="/companies">
                    <Building2 />
                    <span>{translate("crm.companies")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/companies-quickview")}
                  tooltip={translate("crm.companies_quickview", { _: "Unternehmen (Quickview)" })}
                >
                  <Link to="/companies-quickview">
                    <Table />
                    <span>{translate("crm.companies_quickview", { _: "Unternehmen (Quickview)" })}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/deals")}
                  tooltip={translate("crm.deals")}
                >
                  <Link to="/deals">
                    <Handshake />
                    <span>{translate("crm.deals")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Custom Objects (dynamically rendered) */}
        {customObjects && customObjects.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>
                {translate("crm.custom_objects.title", { _: "Custom Objects" })}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {customObjects.map((obj) => (
                    <SidebarMenuItem key={obj.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(`/custom-objects/${obj.name}`)}
                        tooltip={obj.label || obj.name}
                      >
                        <Link to={`/custom-objects/${obj.name}`}>
                          <Box />
                          <span>{obj.label || obj.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        <SidebarSeparator />

        {/* Management */}
        <SidebarGroup>
          <SidebarGroupLabel>
            {translate("crm.management", { _: "Verwaltung" })}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/relationships")}
                  tooltip={translate("crm.relationships", { _: "Verknüpfungen" })}
                >
                  <Link to="/relationships">
                    <Link2 />
                    <span>{translate("crm.relationships", { _: "Verknüpfungen" })}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/audit")}
                  tooltip={translate("crm.audit_log.title", { _: "Änderungsprotokoll" })}
                >
                  <Link to="/audit">
                    <History />
                    <span>{translate("crm.audit_log.title", { _: "Änderungsprotokoll" })}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <CanAccess resource="sales" action="list">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/sales")}
                    tooltip={translate("crm.users")}
                  >
                    <Link to="/sales">
                      <Users />
                      <span>{translate("crm.users")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </CanAccess>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/import")}
                  tooltip={translate("crm.import_data")}
                >
                  <Link to="/import">
                    <Import />
                    <span>{translate("crm.import_data")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {/* Settings */}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/settings")}
              tooltip={translate("crm.settings.title", { _: "Einstellungen" })}
            >
              <Link to="/settings">
                <Settings />
                <span>{translate("crm.settings.title", { _: "Einstellungen" })}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Admin Settings (admin only) */}
          {identity?.administrator && (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/admin/settings")}
                  tooltip={translate("crm.admin.title", { _: "Administration" })}
                >
                  <Link to="/admin/settings">
                    <Shield />
                    <span>{translate("crm.admin.title", { _: "Administration" })}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/admin/settings") && false}
                  tooltip={translate("crm.rbac.quick_edit", { _: "RBAC bearbeiten" })}
                >
                  <Link to="/admin/settings?tab=roles">
                    <Shield />
                    <span>{translate("crm.rbac.quick_edit", { _: "RBAC bearbeiten" })}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}

          {/* Profile */}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/profile")}
              tooltip={translate("crm.my_info")}
            >
              <Link to="/profile">
                <User />
                <span>{translate("crm.my_info")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Theme + Refresh row */}
          <SidebarMenuItem>
            <div className="flex items-center justify-center gap-1 px-2 py-1">
              <ThemeModeToggle />
              <RefreshButton />
              <UserMenu>
                <LogoutOnly />
              </UserMenu>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
};

/** Only show logout in the user menu - navigation is in the sidebar */
const LogoutOnly = () => {
  return null; // Logout is already included by default in UserMenu
};

export default AppSidebar;
