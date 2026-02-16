import {
  type CoreAdminProps,
  CustomRoutes,
  localStorageStore,
  Resource,
  type AuthProvider,
  type DataProvider,
} from "ra-core";
import { useEffect, lazy, Suspense } from "react";
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
const RBACAdminPage = lazy(() => import("../rbac/RBACAdminPage").then(m => ({ default: m.RBACAdminPage })));
const ContactDataGrid = lazy(() => import("../contacts/ContactDataGrid").then(m => ({ default: m.ContactDataGrid })));
const ContactShow = lazy(() => import("../contacts/ContactShow").then(m => ({ default: m.ContactShow })));
const CompanyShow = lazy(() => import("../companies/CompanyShow").then(m => ({ default: m.CompanyShow })));
const NoteShowPage = lazy(() => import("../notes/NoteShowPage").then(m => ({ default: m.NoteShowPage })));
const MobileTasksList = lazy(() => import("../tasks/MobileTasksList").then(m => ({ default: m.MobileTasksList })));
const ContactListMobile = lazy(() => import("../contacts/ContactList").then(m => ({ default: m.ContactListMobile })));

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
import { ConfigurationProvider } from "./ConfigurationContext";
import {
  defaultCompanySectors,
  defaultContactGender,
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

export type CRMProps = {
  dataProvider?: DataProvider;
  authProvider?: AuthProvider;
  disableTelemetry?: boolean;
} & Partial<ConfigurationContextValue>;

export const CRM = ({
  contactGender = defaultContactGender,
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

  const isMobile = useIsMobile();

  const ResponsiveAdmin = isMobile ? MobileAdmin : DesktopAdmin;

  return (
    <ConfigurationProvider
      contactGender={contactGender}
      companySectors={companySectors}
      dealCategories={dealCategories}
      dealPipelineStatuses={dealPipelineStatuses}
      dealStages={dealStages}
      darkModeLogo={darkModeLogo}
      lightModeLogo={lightModeLogo}
      noteStatuses={noteStatuses}
      taskTypes={taskTypes}
      title={title}
      googleWorkplaceDomain={googleWorkplaceDomain}
      disableEmailPasswordAuthentication={disableEmailPasswordAuthentication}
    >
      <ResponsiveAdmin
        dataProvider={dataProvider}
        authProvider={authProvider}
        i18nProvider={i18nProvider}
        store={localStorageStore(undefined, "CRM")}
        loginPage={StartPage}
        requireAuth
        disableTelemetry
        {...rest}
      />
    </ConfigurationProvider>
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
        <Route path="/admin/rbac" element={<SuspenseWrapper><RBACAdminPage /></SuspenseWrapper>} />
        <Route path="/contacts-quickview" element={<SuspenseWrapper><ContactDataGrid /></SuspenseWrapper>} />
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
    </Admin>
  );
};

const LazyMobileDashboard = () => (
  <SuspenseWrapper>
    <MobileDashboard />
  </SuspenseWrapper>
);

const MobileAdmin = (props: CoreAdminProps) => {
  const queryClient = new QueryClient({
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
  const asyncStoragePersister = createAsyncStoragePersister({
    storage: localStorage,
  });

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <Admin
        queryClient={queryClient}
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
