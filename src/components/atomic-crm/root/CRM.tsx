import {
  type CoreAdminProps,
  CustomRoutes,
  localStorageStore,
  Resource,
  type AuthProvider,
} from "ra-core";
import { useEffect, useMemo, lazy, Suspense } from "react";
import { Route } from "react-router";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { Admin } from "@/components/admin/admin";
import { ForgotPasswordPage } from "@/components/supabase/forgot-password-page";
import { SetPasswordPage } from "@/components/supabase/set-password-page";
import { OAuthConsentPage } from "@/components/supabase/oauth-consent-page";
import { PageLoading } from "@/components/ui/loading-spinner";

// Lazy loaded components
const Dashboard = lazy(() => import("../dashboard/Dashboard").then(m => ({ default: m.Dashboard })));
const MobileDashboard = lazy(() => import("../dashboard/MobileDashboard").then(m => ({ default: m.MobileDashboard })));
const SettingsPage = lazy(() => import("../settings/SettingsPage").then(m => ({ default: m.SettingsPage })));
const ImportPage = lazy(() => import("../misc/ImportPage").then(m => ({ default: m.ImportPage })));
const ContactDataGrid = lazy(() => import("../contacts/ContactDataGrid").then(m => ({ default: m.ContactDataGrid })));
const CompanyDataGrid = lazy(() => import("../companies/CompanyDataGrid").then(m => ({ default: m.CompanyDataGrid })));
const GenericDataGrid = lazy(() => import("../GenericDataGrid").then(m => ({ default: m.GenericDataGrid })));
const ContactShow = lazy(() => import("../contacts/ContactShow").then(m => ({ default: m.ContactShow })));
const CompanyShow = lazy(() => import("../companies/CompanyShow").then(m => ({ default: m.CompanyShow })));
const NoteShowPage = lazy(() => import("../notes/NoteShowPage").then(m => ({ default: m.NoteShowPage })));
const MobileTasksList = lazy(() => import("../tasks/MobileTasksList").then(m => ({ default: m.MobileTasksList })));
const ContactListMobile = lazy(() => import("../contacts/ContactList").then(m => ({ default: m.ContactListMobile })));
const AdminSettingsPage = lazy(() => import("../admin/AdminSettingsPage").then(m => ({ default: m.AdminSettingsPage })));
const AuditLogPage = lazy(() => import("../audit/AuditLogPage").then(m => ({ default: m.AuditLogPage })));
const RelationshipsPage = lazy(() => import("../custom-objects/RelationshipsPage").then(m => ({ default: m.RelationshipsPage })));
const CustomObjectListPage = lazy(() => import("../custom-objects/CustomObjectListPage").then(m => ({ default: m.CustomObjectListPage })));
const DeletedRecordsPage = lazy(() => import("./DeletedRecordsPage").then(m => ({ default: m.DeletedRecordsPage })));

import companies from "../companies";
import contacts from "../contacts";
import deals from "../deals";
import { Layout } from "../layout/Layout";
import { MobileLayout } from "../layout/MobileLayout";
import { SignupPage } from "../login/SignupPage";
import { ConfirmationRequired } from "../login/ConfirmationRequired";
import {
  authProvider as defaultAuthProvider,
  dataProvider as defaultDataProvider,
} from "../providers/supabase";
import sales from "../sales";
import type { ConfigurationContextValue } from "./ConfigurationContext";
import { CONFIGURATION_STORE_KEY } from "./ConfigurationContext";
import type { CrmDataProvider } from "../providers/types";
import { ProfilePage } from "../settings/ProfilePage";
import {
  defaultCompanySectors,
  defaultDarkModeLogo,
  defaultDealCategories,
  defaultDealPipelineStatuses,
  defaultDealStages,
  defaultLightModeLogo,
  defaultNoteStatuses,
  defaultTaskTypes,
  defaultTitle,
} from "./defaultConfiguration";
import { i18nProvider } from "./i18nProvider";
import { StartPage } from "../login/StartPage.tsx";
import { useIsMobile } from "@/hooks/use-mobile.ts";

// Suspense Wrapper für Lazy Components
const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoading />}>
    {children}
  </Suspense>
);

const defaultStore = localStorageStore(undefined, "CRM");

export type CRMProps = {
  dataProvider?: CrmDataProvider;
  authProvider?: AuthProvider;
  disableTelemetry?: boolean;
  store?: CoreAdminProps["store"];
} & Partial<ConfigurationContextValue>;

export const CRM = ({
  companySectors = defaultCompanySectors,
  dealCategories = defaultDealCategories,
  dealPipelineStatuses = defaultDealPipelineStatuses,
  dealStages = defaultDealStages,
  darkModeLogo = defaultDarkModeLogo,
  lightModeLogo = defaultLightModeLogo,
  noteStatuses = defaultNoteStatuses,
  taskTypes = defaultTaskTypes,
  title = defaultTitle,
  dataProvider = defaultDataProvider,
  authProvider = defaultAuthProvider,
  store = defaultStore,
  googleWorkplaceDomain = import.meta.env.VITE_GOOGLE_WORKPLACE_DOMAIN,
  disableEmailPasswordAuthentication = import.meta.env
    .VITE_DISABLE_EMAIL_PASSWORD_AUTHENTICATION === "true",
  disableTelemetry,
  ...rest
}: CRMProps) => {
  useEffect(() => {
    if (
      disableTelemetry ||
      process.env.NODE_ENV !== "production" ||
      typeof window === "undefined" ||
      typeof window.location === "undefined" ||
      typeof Image === "undefined"
    ) {
      return;
    }
    const img = new Image();
    img.src = `https://atomic-crm-telemetry.marmelab.com/atomic-crm-telemetry?domain=${window.location.hostname}`;
  }, [disableTelemetry]);

  // Seed the store with CRM prop values if not already stored
  // (backwards compatibility for prop-based config)
  if (!store.getItem(CONFIGURATION_STORE_KEY)) {
    store.setItem(CONFIGURATION_STORE_KEY, {
      companySectors,
      dealCategories,
      dealPipelineStatuses,
      dealStages,
      noteStatuses,
      taskTypes,
      title,
      darkModeLogo,
      lightModeLogo,
      googleWorkplaceDomain,
      disableEmailPasswordAuthentication,
    } satisfies ConfigurationContextValue);
  }

  const isMobile = useIsMobile();

  // on login, pre-fetch the configuration to avoid a flickering
  // when accessing the app for the first time
  const wrappedAuthProvider = useMemo<AuthProvider>(
    () => ({
      ...authProvider,
      login: async (params: any) => {
        const result = await authProvider.login(params);
        try {
          const config = await dataProvider.getConfiguration();
          if (Object.keys(config).length > 0) {
            store.setItem(CONFIGURATION_STORE_KEY, config);
          }
        } catch {
          // Non-critical: config will load via useConfigurationLoader
        }
        return result;
      },
      handleCallback: async (params: any) => {
        if (!authProvider.handleCallback) {
          throw new Error(
            "handleCallback is not implemented in the authProvider",
          );
        }
        const result = await authProvider.handleCallback(params);
        try {
          const config = await dataProvider.getConfiguration();
          if (Object.keys(config).length > 0) {
            store.setItem(CONFIGURATION_STORE_KEY, config);
          }
        } catch {
          // Non-critical: config will load via useConfigurationLoader
        }
        return result;
      },
      logout: async (params: any) => {
        try {
          store.removeItem(CONFIGURATION_STORE_KEY);
        } catch {
          // Ignore
        }
        return authProvider.logout(params);
      },
    }),
    [authProvider, dataProvider, store],
  );

  const ResponsiveAdmin = isMobile ? MobileAdmin : DesktopAdmin;

  return (
    <ResponsiveAdmin
      dataProvider={dataProvider}
      authProvider={wrappedAuthProvider}
      i18nProvider={i18nProvider}
      store={store}
      loginPage={StartPage}
      requireAuth
      disableTelemetry
      {...rest}
    />
  );
};

const LazyDashboard = () => (
  <SuspenseWrapper>
    <Dashboard />
  </SuspenseWrapper>
);

const DesktopAdmin = (props: CoreAdminProps) => {
  return (
    <Admin layout={Layout} dashboard={LazyDashboard} {...props}>
      <CustomRoutes noLayout>
        <Route path={SignupPage.path} element={<SignupPage />} />
        <Route
          path={ConfirmationRequired.path}
          element={<ConfirmationRequired />}
        />
        <Route path={SetPasswordPage.path} element={<SetPasswordPage />} />
        <Route
          path={ForgotPasswordPage.path}
          element={<ForgotPasswordPage />}
        />
        <Route path={OAuthConsentPage.path} element={<OAuthConsentPage />} />
      </CustomRoutes>
      <CustomRoutes>
        <Route path="/settings" element={<SuspenseWrapper><SettingsPage /></SuspenseWrapper>} />
        <Route path="/import" element={<SuspenseWrapper><ImportPage /></SuspenseWrapper>} />
        <Route path="/admin/settings" element={<SuspenseWrapper><AdminSettingsPage /></SuspenseWrapper>} />
        <Route path="/contacts-quickview" element={<SuspenseWrapper><GenericDataGrid key="contacts" resource="contacts" entityType="contacts" enableSoftDelete /></SuspenseWrapper>} />
        <Route path="/companies-quickview" element={<SuspenseWrapper><GenericDataGrid key="companies" resource="companies" entityType="companies" enableSoftDelete /></SuspenseWrapper>} />
        <Route path="/deals-quickview" element={<SuspenseWrapper><GenericDataGrid key="deals" resource="deals" entityType="deals" enableSoftDelete /></SuspenseWrapper>} />
        <Route path="/audit" element={<SuspenseWrapper><AuditLogPage /></SuspenseWrapper>} />
        <Route path="/deleted" element={<SuspenseWrapper><DeletedRecordsPage /></SuspenseWrapper>} />
        <Route path="/relationships" element={<SuspenseWrapper><RelationshipsPage /></SuspenseWrapper>} />
        <Route path="/custom-objects/:objectName" element={<SuspenseWrapper><CustomObjectListPage /></SuspenseWrapper>} />
        <Route path={ProfilePage.path} element={<ProfilePage />} />
      </CustomRoutes>
      <Resource name="deals" {...deals} />
      <Resource name="contacts" {...contacts} />
      <Resource name="companies" {...companies} />
      <Resource name="contact_notes" />
      <Resource name="deal_notes" />
      <Resource name="tasks" />
      <Resource name="sales" {...sales} />
      <Resource name="tags" />
      <Resource name="roles" />
      <Resource name="role_permissions" />
      <Resource name="teams" />
      <Resource name="team_members" />
      <Resource name="user_roles" />
      <Resource name="team_roles" />
      <Resource name="audit_logs" />
      <Resource name="record_versions" />
      <Resource name="custom_object_definitions" />
      <Resource name="custom_field_definitions" />
      <Resource name="custom_field_values" />
      <Resource name="custom_object_data" />
      <Resource name="object_relationships" />
      <Resource name="relationship_definitions" />
      <Resource name="attribute_definitions" />
      <Resource name="user_attributes" />
      <Resource name="permission_conditions" />
      <Resource name="events" />
      <Resource name="locks" />
      <Resource name="categories" />
      <Resource name="saved_views" />
    </Admin>
  );
};

const LazyMobileDashboard = () => (
  <SuspenseWrapper>
    <MobileDashboard />
  </SuspenseWrapper>
);

const mobileQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      networkMode: "offlineFirst",
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

const mobileAsyncStoragePersister = createAsyncStoragePersister({
  storage: localStorage,
});

const MobileAdmin = (props: CoreAdminProps) => {
  return (
    <PersistQueryClientProvider
      client={mobileQueryClient}
      persistOptions={{ persister: mobileAsyncStoragePersister }}
    >
      <Admin
        queryClient={mobileQueryClient}
        layout={MobileLayout}
        dashboard={LazyMobileDashboard}
        {...props}
      >
        <CustomRoutes noLayout>
          <Route path={SignupPage.path} element={<SignupPage />} />
          <Route
            path={ConfirmationRequired.path}
            element={<ConfirmationRequired />}
          />
          <Route path={SetPasswordPage.path} element={<SetPasswordPage />} />
          <Route
            path={ForgotPasswordPage.path}
            element={<ForgotPasswordPage />}
          />
          <Route path={OAuthConsentPage.path} element={<OAuthConsentPage />} />
        </CustomRoutes>
        <Resource
          name="contacts"
          list={() => <SuspenseWrapper><ContactListMobile /></SuspenseWrapper>}
          show={() => <SuspenseWrapper><ContactShow /></SuspenseWrapper>}
          recordRepresentation={contacts.recordRepresentation}
        >
          <Route path=":id/notes/:noteId" element={<SuspenseWrapper><NoteShowPage /></SuspenseWrapper>} />
        </Resource>
        <Resource name="companies" show={() => <SuspenseWrapper><CompanyShow /></SuspenseWrapper>} />
        <Resource name="tasks" list={() => <SuspenseWrapper><MobileTasksList /></SuspenseWrapper>} />
      </Admin>
    </PersistQueryClientProvider>
  );
};
