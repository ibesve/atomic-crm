import { Import, Settings, User, Users } from "lucide-react";
import { CanAccess, useGetIdentity, useTranslate, useUserMenu } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import { RefreshButton } from "@/components/admin/refresh-button";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { ImportPage } from "../misc/ImportPage";

const Header = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();
  const location = useLocation();
  const translate = useTranslate();

  let currentPath: string | boolean = "/";
  if (matchPath("/", location.pathname)) {
    currentPath = "/";
  } else if (matchPath("/contacts-quickview", location.pathname)) {
    currentPath = "/contacts-quickview";
  } else if (matchPath("/contacts/*", location.pathname)) {
    currentPath = "/contacts";
  } else if (matchPath("/companies-quickview", location.pathname)) {
    currentPath = "/companies-quickview";
  } else if (matchPath("/companies/*", location.pathname)) {
    currentPath = "/companies";
  } else if (matchPath("/deals/*", location.pathname)) {
    currentPath = "/deals";
  } else {
    currentPath = false;
  }

  return (
    <>
      <nav className="grow">
        <header className="bg-secondary">
          <div className="px-4">
            <div className="flex justify-between items-center flex-1">
              <Link
                to="/"
                className="flex items-center gap-2 text-secondary-foreground no-underline"
              >
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
                <h1 className="text-xl font-semibold">{title}</h1>
              </Link>
              <div>
                <nav className="flex">
                  <NavigationTab
                    label={translate("crm.dashboard")}
                    to="/"
                    isActive={currentPath === "/"}
                  />
                  <NavigationTab
                    label={translate("crm.contacts")}
                    to="/contacts"
                    isActive={currentPath === "/contacts"}
                  />
                  <NavigationTab
                    label={translate("crm.contacts_quickview", { _: "Kontakte (Quickview)" })}
                    to="/contacts-quickview"
                    isActive={currentPath === "/contacts-quickview"}
                  />
                  <NavigationTab
                    label={translate("crm.companies")}
                    to="/companies"
                    isActive={currentPath === "/companies"}
                  />
                  <NavigationTab
                    label={translate("crm.companies_quickview", { _: "Unternehmen (Quickview)" })}
                    to="/companies-quickview"
                    isActive={currentPath === "/companies-quickview"}
                  />
                  <NavigationTab
                    label={translate("crm.deals")}
                    to="/deals"
                    isActive={currentPath === "/deals"}
                  />
                </nav>
              </div>
              <div className="flex items-center">
                <ThemeModeToggle />
                <RefreshButton />
                <UserMenu>
                  <ProfileMenu />
                  <CanAccess resource="sales" action="list">
                    <UsersMenu />
                  </CanAccess>
                  <AdminSettingsMenu />
                  <ImportFromJsonMenuItem />
                </UserMenu>
              </div>
            </div>
          </div>
        </header>
      </nav>
    </>
  );
};

const NavigationTab = ({
  label,
  to,
  isActive,
}: {
  label: string;
  to: string;
  isActive: boolean;
}) => (
  <Link
    to={to}
    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
      isActive
        ? "text-secondary-foreground border-secondary-foreground"
        : "text-secondary-foreground/70 border-transparent hover:text-secondary-foreground/80"
    }`}
  >
    {label}
  </Link>
);

const UsersMenu = () => {
  const userMenuContext = useUserMenu();
  const translate = useTranslate();
  if (!userMenuContext) {
    throw new Error("<UsersMenu> must be used inside <UserMenu?");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to="/sales" className="flex items-center gap-2">
        <User /> {translate("crm.users")}
      </Link>
    </DropdownMenuItem>
  );
};

const ProfileMenu = () => {
  const userMenuContext = useUserMenu();
  const translate = useTranslate();
  if (!userMenuContext) {
    throw new Error("<ProfileMenu> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to="/profile" className="flex items-center gap-2">
        <Settings />
        {translate("crm.my_info")}
      </Link>
    </DropdownMenuItem>
  );
};

const ImportFromJsonMenuItem = () => {
  const userMenuContext = useUserMenu();
  const translate = useTranslate();
  if (!userMenuContext) {
    throw new Error("<ImportFromJsonMenuItem> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to={ImportPage.path} className="flex items-center gap-2">
        <Import /> {translate("crm.import_data")}
      </Link>
    </DropdownMenuItem>
  );
};

const AdminSettingsMenu = () => {
  const userMenuContext = useUserMenu();
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  
  if (!userMenuContext) {
    return null;
  }

  // Nur für Administratoren anzeigen
  if (!identity?.administrator) {
    return null;
  }
  
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to="/admin/settings" className="flex items-center gap-2">
        <Settings className="w-4 h-4" />
        {translate("crm.admin.title", { _: "Administration" })}
      </Link>
    </DropdownMenuItem>
  );
};

export default Header;
