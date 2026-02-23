import { useMutation } from "@tanstack/react-query";
import { 
  CircleX, 
  Copy, 
  Pencil, 
  Save, 
  User, 
  Bell, 
  Palette, 
  Languages,
  Settings,
  Sun,
  Moon,
  Monitor,
  Check,
  Link2,
} from "lucide-react";
import {
  Form,
  useDataProvider,
  useGetIdentity,
  useGetOne,
  useNotify,
  useRecordContext,
  useTranslate,
} from "ra-core";
import { useState, useEffect } from "react";
import { useFormState } from "react-hook-form";
import { RecordField } from "@/components/admin/record-field";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import ImageEditorField from "../misc/ImageEditorField";
import { RelationshipDefinitionManager } from "../custom-objects/RelationshipDefinitionManager";
import type { CrmDataProvider } from "../providers/types";
import type { Sale, SalesFormData } from "../types";
import { RotateCcw, Save } from "lucide-react";
import type { RaRecord } from "ra-core";
import { EditBase, Form, useGetList, useInput, useNotify } from "ra-core";
import { useCallback, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toSlug } from "@/lib/toSlug";
import { ArrayInput } from "@/components/admin/array-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { TextInput } from "@/components/admin/text-input";

import ImageEditorField from "../misc/ImageEditorField";
import {
  useConfigurationContext,
  useConfigurationUpdater,
  type ConfigurationContextValue,
} from "../root/ConfigurationContext";
import { defaultConfiguration } from "../root/defaultConfiguration";

const SECTIONS = [
  { id: "branding", label: "Branding" },
  { id: "companies", label: "Companies" },
  { id: "deals", label: "Deals" },
  { id: "notes", label: "Notes" },
  { id: "tasks", label: "Tasks" },
];

/** Ensure every item in a { value, label } array has a value (slug from label). */
const ensureValues = (items: { value?: string; label: string }[] | undefined) =>
  items?.map((item) => ({ ...item, value: item.value || toSlug(item.label) }));

/**
 * Validate that no items were removed if they are still referenced by existing deals.
 * Also rejects duplicate slug values.
 * Returns undefined if valid, or an error message string.
 */
export const validateItemsInUse = (
  items: { value: string; label: string }[] | undefined,
  deals: RaRecord[] | undefined,
  fieldName: string,
  displayName: string,
) => {
  if (!items) return undefined;
  // Check for duplicate slugs
  const slugs = items.map((i) => i.value || toSlug(i.label));
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const slug of slugs) {
    if (seen.has(slug)) duplicates.add(slug);
    seen.add(slug);
  }
  if (duplicates.size > 0) {
    return `Duplicate ${displayName}: ${[...duplicates].join(", ")}`;
  }
  // Check that no in-use value was removed (skip if deals haven't loaded)
  if (!deals) return "Validating…";
  const values = new Set(slugs);
  const inUse = [
    ...new Set(
      deals
        .filter(
          (deal) => deal[fieldName] && !values.has(deal[fieldName] as string),
        )
        .map((deal) => deal[fieldName] as string),
    ),
  ];
  if (inUse.length > 0) {
    return `Cannot remove ${displayName} that are still used by deals: ${inUse.join(", ")}`;
  }
  return undefined;
};

const transformFormValues = (data: Record<string, any>) => ({
  config: {
    title: data.title,
    lightModeLogo: data.lightModeLogo,
    darkModeLogo: data.darkModeLogo,
    companySectors: ensureValues(data.companySectors),
    dealCategories: ensureValues(data.dealCategories),
    taskTypes: ensureValues(data.taskTypes),
    dealStages: ensureValues(data.dealStages),
    dealPipelineStatuses: data.dealPipelineStatuses,
    noteStatuses: ensureValues(data.noteStatuses),
  } as ConfigurationContextValue,
});

// Theme types
type Theme = "light" | "dark" | "system";

// Hook für Theme-Management
const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as Theme) || "system";
    }
    return "system";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }

    localStorage.setItem("theme", theme);
  }, [theme]);

  return { theme, setTheme: setThemeState };
};

// Hook für Benutzereinstellungen
const useUserSettings = () => {
  const [settings, setSettings] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("userSettings");
      return saved ? JSON.parse(saved) : {
        notifications: {
          emailNewDeals: true,
          emailTaskReminders: true,
          emailWeeklyReport: false,
          browserNotifications: true,
        },
        language: "de",
      };
    }
    return {
      notifications: {
        emailNewDeals: true,
        emailTaskReminders: true,
        emailWeeklyReport: false,
        browserNotifications: true,
      },
      language: "de",
    };
  });

  const updateSettings = (newSettings: typeof settings) => {
    setSettings(newSettings);
    localStorage.setItem("userSettings", JSON.stringify(newSettings));
  };

  return { settings, updateSettings };
};

export const SettingsPage = () => {
  const translate = useTranslate();
  const [isEditMode, setEditMode] = useState(false);
  const { identity, refetch: refetchIdentity } = useGetIdentity();
  const { data, refetch: refetchUser } = useGetOne("sales", {
    id: identity?.id,
  });
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings } = useUserSettings();

  const { mutate } = useMutation({
    mutationKey: ["signup"],
    mutationFn: async (data: SalesFormData) => {
      if (!identity) {
        throw new Error("Record not found");
      }
      return dataProvider.salesUpdate(identity.id, data);
    },
    onSuccess: () => {
      refetchIdentity();
      refetchUser();
      setEditMode(false);
      notify(translate("crm.settings.profile_updated", { _: "Profil wurde aktualisiert" }));
    },
    onError: (_) => {
      notify(translate("crm.settings.error", { _: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut." }), {
        type: "error",
      });
    },
  });
  const updateConfiguration = useConfigurationUpdater();
  const notify = useNotify();

  return (
    <EditBase
      resource="configuration"
      id={1}
      mutationMode="pessimistic"
      redirect={false}
      transform={transformFormValues}
      mutationOptions={{
        onSuccess: (data: any) => {
          updateConfiguration(data.config);
          notify("Configuration saved successfully");
        },
        onError: () => {
          notify("Failed to save configuration", { type: "error" });
        },
      }}
    >
      <SettingsForm />
    </EditBase>
  );
};

SettingsPage.path = "/settings";

const SettingsForm = () => {
  const config = useConfigurationContext();

  const defaultValues = useMemo(
    () => ({
      title: config.title,
      lightModeLogo: { src: config.lightModeLogo },
      darkModeLogo: { src: config.darkModeLogo },
      companySectors: config.companySectors,
      dealCategories: config.dealCategories,
      taskTypes: config.taskTypes,
      dealStages: config.dealStages,
      dealPipelineStatuses: config.dealPipelineStatuses,
      noteStatuses: config.noteStatuses,
    }),
    [config],
  );

  const handleNotificationChange = (key: string, value: boolean) => {
    updateSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        [key]: value,
      },
    });
    notify(translate("crm.settings.settings_saved", { _: "Einstellungen gespeichert" }));
  };

  const handleLanguageChange = (value: string) => {
    updateSettings({
      ...settings,
      language: value,
    });
    notify(translate("crm.settings.language_changed", { _: "Sprache wurde geändert. Änderungen werden nach dem Neuladen wirksam." }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Settings className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {translate("crm.settings.title", { _: "Einstellungen" })}
          </h1>
          <p className="text-muted-foreground">
            {translate("crm.settings.subtitle", { _: "Verwalten Sie Ihr Profil und Ihre Präferenzen" })}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">
              {translate("crm.settings.profile", { _: "Profil" })}
            </span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">
              {translate("crm.settings.notifications", { _: "Benachrichtigungen" })}
            </span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">
              {translate("crm.settings.appearance", { _: "Darstellung" })}
            </span>
          </TabsTrigger>
          <TabsTrigger value="language" className="gap-2">
            <Languages className="w-4 h-4" />
            <span className="hidden sm:inline">
              {translate("crm.settings.language", { _: "Sprache" })}
            </span>
          </TabsTrigger>
          <TabsTrigger value="custom-objects" className="gap-2">
            <Link2 className="w-4 h-4" />
            <span className="hidden sm:inline">
              {translate("crm.settings.custom_objects", { _: "Beziehungen" })}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Profil Tab */}
        <TabsContent value="profile">
          <Form onSubmit={handleOnSubmit} record={data}>
            <ProfileForm isEditMode={isEditMode} setEditMode={setEditMode} />
          </Form>
        </TabsContent>

        {/* Benachrichtigungen Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                {translate("crm.settings.notification_preferences", { _: "Benachrichtigungseinstellungen" })}
              </CardTitle>
              <CardDescription>
                {translate("crm.settings.notification_description", { _: "Legen Sie fest, wie und wann Sie benachrichtigt werden möchten." })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* E-Mail Benachrichtigungen */}
              <div>
                <h3 className="text-lg font-medium mb-4">
                  {translate("crm.settings.email_notifications", { _: "E-Mail-Benachrichtigungen" })}
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailNewDeals">
                        {translate("crm.settings.new_deals", { _: "Neue Deals" })}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {translate("crm.settings.new_deals_description", { _: "Erhalten Sie eine E-Mail, wenn ein neuer Deal erstellt wird." })}
                      </p>
                    </div>
                    <Switch
                      id="emailNewDeals"
                      checked={settings.notifications.emailNewDeals}
                      onCheckedChange={(value) => handleNotificationChange("emailNewDeals", value)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailTaskReminders">
                        {translate("crm.settings.task_reminders", { _: "Aufgaben-Erinnerungen" })}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {translate("crm.settings.task_reminders_description", { _: "Erhalten Sie Erinnerungen für anstehende Aufgaben." })}
                      </p>
                    </div>
                    <Switch
                      id="emailTaskReminders"
                      checked={settings.notifications.emailTaskReminders}
                      onCheckedChange={(value) => handleNotificationChange("emailTaskReminders", value)}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailWeeklyReport">
                        {translate("crm.settings.weekly_report", { _: "Wöchentlicher Bericht" })}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {translate("crm.settings.weekly_report_description", { _: "Erhalten Sie eine wöchentliche Zusammenfassung Ihrer Aktivitäten." })}
                      </p>
                    </div>
                    <Switch
                      id="emailWeeklyReport"
                      checked={settings.notifications.emailWeeklyReport}
                      onCheckedChange={(value) => handleNotificationChange("emailWeeklyReport", value)}
                    />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {/* Browser Benachrichtigungen */}
              <div>
                <h3 className="text-lg font-medium mb-4">
                  {translate("crm.settings.browser_notifications", { _: "Browser-Benachrichtigungen" })}
                </h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="browserNotifications">
                      {translate("crm.settings.enable_browser_notifications", { _: "Browser-Benachrichtigungen aktivieren" })}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {translate("crm.settings.browser_notifications_description", { _: "Erhalten Sie Desktop-Benachrichtigungen im Browser." })}
                    </p>
                  </div>
                  <Switch
                    id="browserNotifications"
                    checked={settings.notifications.browserNotifications}
                    onCheckedChange={(value) => handleNotificationChange("browserNotifications", value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Darstellung Tab */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                {translate("crm.settings.appearance_settings", { _: "Darstellungseinstellungen" })}
              </CardTitle>
              <CardDescription>
                {translate("crm.settings.appearance_description", { _: "Passen Sie das Erscheinungsbild der Anwendung an." })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">
                  {translate("crm.settings.theme", { _: "Farbschema" })}
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <ThemeOption
                    value="light"
                    currentTheme={theme}
                    onSelect={setTheme}
                    icon={<Sun className="w-6 h-6" />}
                    label={translate("crm.settings.theme_light", { _: "Hell" })}
                    description={translate("crm.settings.theme_light_description", { _: "Helles Farbschema" })}
                  />
                  <ThemeOption
                    value="dark"
                    currentTheme={theme}
                    onSelect={setTheme}
                    icon={<Moon className="w-6 h-6" />}
                    label={translate("crm.settings.theme_dark", { _: "Dunkel" })}
                    description={translate("crm.settings.theme_dark_description", { _: "Dunkles Farbschema" })}
                  />
                  <ThemeOption
                    value="system"
                    currentTheme={theme}
                    onSelect={setTheme}
                    icon={<Monitor className="w-6 h-6" />}
                    label={translate("crm.settings.theme_system", { _: "System" })}
                    description={translate("crm.settings.theme_system_description", { _: "Automatisch" })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sprache Tab */}
        <TabsContent value="language">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="w-5 h-5" />
                {translate("crm.settings.language_settings", { _: "Spracheinstellungen" })}
              </CardTitle>
              <CardDescription>
                {translate("crm.settings.language_description", { _: "Wählen Sie Ihre bevorzugte Sprache für die Benutzeroberfläche." })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="language" className="text-lg font-medium">
                  {translate("crm.settings.select_language", { _: "Sprache auswählen" })}
                </Label>
                <p className="text-sm text-muted-foreground mb-4">
                  {translate("crm.settings.language_info", { _: "Weitere Sprachen werden in zukünftigen Updates verfügbar sein." })}
                </p>
                <Select 
                  value={settings.language} 
                  onValueChange={handleLanguageChange}
                >
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue placeholder="Sprache wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de">
                      <span className="flex items-center gap-2">
                        🇩🇪 Deutsch
                      </span>
                    </SelectItem>
                    <SelectItem value="en" disabled>
                      <span className="flex items-center gap-2">
                        🇬🇧 English (Coming soon)
                      </span>
                    </SelectItem>
                    <SelectItem value="fr" disabled>
                      <span className="flex items-center gap-2">
                        🇫🇷 Français (Coming soon)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Objects & Beziehungen Tab */}
        <TabsContent value="custom-objects">
          <RelationshipDefinitionManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Theme Option Component
const ThemeOption = ({
  value,
  currentTheme,
  onSelect,
  icon,
  label,
  description,
}: {
  value: Theme;
  currentTheme: Theme;
  onSelect: (theme: Theme) => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}) => {
  const isSelected = currentTheme === value;
  
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`relative flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-muted hover:border-primary/50 hover:bg-muted/50"
      }`}
    >
      {isSelected && (
        <div className="absolute top-2 right-2">
          <Check className="w-4 h-4 text-primary" />
        </div>
      )}
      <div className={`mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
        {icon}
      </div>
      <span className={`font-medium ${isSelected ? "text-primary" : ""}`}>
        {label}
      </span>
      <span className="text-xs text-muted-foreground mt-1">
        {description}
      </span>
    </button>
  );
};

// Profil Form Component (aus der ursprünglichen SettingsForm extrahiert)
const ProfileForm = ({
  isEditMode,
  setEditMode,
}: {
  isEditMode: boolean;
  setEditMode: (value: boolean) => void;
}) => {
  const notify = useNotify();
  const translate = useTranslate();
  const record = useRecordContext<Sale>();
  const { identity, refetch } = useGetIdentity();
  const { isDirty } = useFormState();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { mutate: updatePassword } = useMutation({
    mutationKey: ["updatePassword"],
    mutationFn: async () => {
      if (!identity) {
        throw new Error("Record not found");
      }
      return dataProvider.updatePassword(identity.id);
    },
    onSuccess: () => {
      notify(translate("crm.settings.password_reset_sent", { _: "Eine E-Mail zum Zurücksetzen des Passworts wurde gesendet." }));
    },
    onError: (e) => {
      notify(`${e}`, {
        type: "error",
      });
    },
  });

  const { mutate: mutateSale } = useMutation({
    mutationKey: ["signup"],
    mutationFn: async (data: SalesFormData) => {
      if (!record) {
        throw new Error("Record not found");
      }
      return dataProvider.salesUpdate(record.id, data);
    },
    onSuccess: () => {
      refetch();
      notify(translate("crm.settings.profile_updated", { _: "Profil wurde aktualisiert" }));
    },
    onError: () => {
      notify(translate("crm.settings.error", { _: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut." }));
    },
  });

  if (!identity) return null;
    <Form defaultValues={defaultValues}>
      <SettingsFormFields />
    </Form>
  );
};

const SettingsFormFields = () => {
  const {
    watch,
    setValue,
    reset,
    formState: { isSubmitting },
  } = useFormContext();

  const dealStages = watch("dealStages");
  const dealPipelineStatuses: string[] = watch("dealPipelineStatuses") ?? [];

  const { data: deals } = useGetList("deals", {
    pagination: { page: 1, perPage: 1000 },
  });

  const validateDealStages = useCallback(
    (stages: { value: string; label: string }[] | undefined) =>
      validateItemsInUse(stages, deals, "stage", "stages"),
    [deals],
  );

  const validateDealCategories = useCallback(
    (categories: { value: string; label: string }[] | undefined) =>
      validateItemsInUse(categories, deals, "category", "categories"),
    [deals],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {translate("crm.settings.my_profile", { _: "Mein Profil" })}
          </CardTitle>
          <CardDescription>
            {translate("crm.settings.profile_description", { _: "Verwalten Sie Ihre persönlichen Informationen." })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-4">
            <ImageEditorField
              source="avatar"
              type="avatar"
              onSave={handleAvatarUpdate}
              linkPosition="right"
            />
            <TextRender 
              source="first_name" 
              isEditMode={isEditMode} 
              label={translate("crm.settings.first_name", { _: "Vorname" })}
            />
            <TextRender 
              source="last_name" 
              isEditMode={isEditMode} 
              label={translate("crm.settings.last_name", { _: "Nachname" })}
            />
            <TextRender 
              source="email" 
              isEditMode={isEditMode} 
              label={translate("crm.settings.email", { _: "E-Mail" })}
            />
          </div>
          <div className="flex flex-row justify-end gap-2">
            {!isEditMode && (
              <Button
                variant="outline"
                type="button"
                onClick={handleClickOpenPasswordChange}
              >
                {translate("crm.settings.change_password", { _: "Passwort ändern" })}
              </Button>
            )}
    <div className="flex gap-8 mt-4 pb-20">
      {/* Left navigation */}
      <nav className="hidden md:block w-48 shrink-0">
        <div className="sticky top-4 space-y-1">
          <h1 className="text-2xl font-semibold px-3 mb-2">Settings</h1>
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => {
                document
                  .getElementById(section.id)
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="block w-full text-left px-3 py-1 text-sm rounded-md hover:text-foreground hover:bg-muted transition-colors"
            >
              {section.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 min-w-0 max-w-2xl space-y-6">
        {/* Branding */}
        <Card id="branding">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Branding
            </h2>
            <TextInput source="title" label="App Title" />
            <div className="flex gap-8">
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted-foreground">Light Mode Logo</p>
                <ImageEditorField
                  source="lightModeLogo"
                  width={100}
                  height={100}
                  linkPosition="bottom"
                  backgroundImageColor="#f5f5f5"
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted-foreground">Dark Mode Logo</p>
                <ImageEditorField
                  source="darkModeLogo"
                  width={100}
                  height={100}
                  linkPosition="bottom"
                  backgroundImageColor="#1a1a1a"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Companies */}
        <Card id="companies">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Companies
            </h2>
            <h3 className="text-lg font-medium text-muted-foreground">
              Sectors
            </h3>
            <ArrayInput
              source="companySectors"
              label={false}
              helperText={false}
            >
              <SimpleFormIterator disableReordering disableClear>
                <TextInput source="label" label={false} />
              </SimpleFormIterator>
            </ArrayInput>
          </CardContent>
        </Card>

        {/* Deals */}
        <Card id="deals">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Deals
            </h2>
            <h3 className="text-lg font-medium text-muted-foreground">
              Stages
            </h3>
            <ArrayInput
              source="dealStages"
              label={false}
              helperText={false}
              validate={validateDealStages}
            >
              <SimpleFormIterator disableClear>
                <TextInput source="label" label={false} />
              </SimpleFormIterator>
            </ArrayInput>

            <Separator />

            <h3 className="text-lg font-medium text-muted-foreground">
              Pipeline Statuses
            </h3>
            <p className="text-sm text-muted-foreground">
              Select which deal stages count as &quot;pipeline&quot; (completed)
              deals.
            </p>
            <div className="flex flex-wrap gap-2">
              {dealStages?.map(
                (stage: { value: string; label: string }, idx: number) => {
                  const isSelected = dealPipelineStatuses.includes(stage.value);
                  return (
                    <Button
                      key={idx}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (isSelected) {
                          setValue(
                            "dealPipelineStatuses",
                            dealPipelineStatuses.filter(
                              (s) => s !== stage.value,
                            ),
                          );
                        } else {
                          setValue("dealPipelineStatuses", [
                            ...dealPipelineStatuses,
                            stage.value,
                          ]);
                        }
                      }}
                    >
                      {stage.label || stage.value}
                    </Button>
                  );
                },
              )}
            </div>

            <Separator />

            <h3 className="text-lg font-medium text-muted-foreground">
              Categories
            </h3>
            <ArrayInput
              source="dealCategories"
              label={false}
              helperText={false}
              validate={validateDealCategories}
            >
              <SimpleFormIterator disableReordering disableClear>
                <TextInput source="label" label={false} />
              </SimpleFormIterator>
            </ArrayInput>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card id="notes">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Notes
            </h2>
            <h3 className="text-lg font-medium text-muted-foreground">
              Statuses
            </h3>
            <ArrayInput source="noteStatuses" label={false} helperText={false}>
              <SimpleFormIterator inline disableReordering disableClear>
                <TextInput source="label" label={false} className="flex-1" />
                <ColorInput source="color" />
              </SimpleFormIterator>
            </ArrayInput>
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card id="tasks">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Tasks
            </h2>
            <h3 className="text-lg font-medium text-muted-foreground">Types</h3>
            <ArrayInput source="taskTypes" label={false} helperText={false}>
              <SimpleFormIterator disableReordering disableClear>
                <TextInput source="label" label={false} />
              </SimpleFormIterator>
            </ArrayInput>
          </CardContent>
        </Card>
      </div>

      {/* Sticky save button */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4">
        <div className="max-w-screen-xl mx-auto flex gap-8 px-4">
          <div className="hidden md:block w-48 shrink-0" />
          <div className="flex-1 min-w-0 max-w-2xl flex justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                reset({
                  ...defaultConfiguration,
                  lightModeLogo: {
                    src: defaultConfiguration.lightModeLogo,
                  },
                  darkModeLogo: { src: defaultConfiguration.darkModeLogo },
                })
              }
            >
              {isEditMode ? <CircleX className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}
              {isEditMode 
                ? translate("crm.settings.cancel", { _: "Abbrechen" })
                : translate("crm.settings.edit", { _: "Bearbeiten" })
              }
            </Button>
            {isEditMode && (
              <Button type="submit" disabled={!isDirty} variant="default">
                <Save className="mr-2 h-4 w-4" />
                {translate("crm.settings.save", { _: "Speichern" })}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {import.meta.env.VITE_INBOUND_EMAIL && (
        <Card>
          <CardHeader>
            <CardTitle>
              {translate("crm.settings.inbound_email", { _: "Eingehende E-Mails" })}
            </CardTitle>
            <CardDescription>
              {translate("crm.settings.inbound_email_description", { 
                _: "Sie können E-Mails an die Serveradresse senden, z.B. im Cc:-Feld. Atomic CRM verarbeitet die E-Mails und fügt Notizen zu den entsprechenden Kontakten hinzu." 
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CopyPaste />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const TextRender = ({
  source,
  isEditMode,
  label,
}: {
  source: string;
  isEditMode: boolean;
  label?: string;
}) => {
  if (isEditMode) {
    return <TextInput source={source} label={label} helperText={false} />;
  }
  return (
    <div className="m-2">
      {label && <Label className="text-sm text-muted-foreground">{label}</Label>}
      <RecordField source={source} />
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset to Defaults
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-1" />
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CopyPaste = () => {
  const [copied, setCopied] = useState(false);
  const translate = useTranslate();
  
  const handleCopy = () => {
    setCopied(true);
    navigator.clipboard.writeText(import.meta.env.VITE_INBOUND_EMAIL);
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            onClick={handleCopy}
            variant="ghost"
            className="normal-case justify-between w-full"
          >
            <span className="overflow-hidden text-ellipsis">
              {import.meta.env.VITE_INBOUND_EMAIL}
            </span>
            <Copy className="h-4 w-4 ml-2" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{copied 
            ? translate("crm.settings.copied", { _: "Kopiert!" })
            : translate("crm.settings.copy", { _: "Kopieren" })
          }</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
/** A minimal color picker input compatible with ra-core's useInput. */
const ColorInput = ({ source }: { source: string }) => {
  const { field } = useInput({ source });
  return (
    <input
      type="color"
      {...field}
      value={field.value || "#000000"}
      className="w-9 h-9 shrink-0 cursor-pointer appearance-none rounded border bg-transparent p-0.5 [&::-webkit-color-swatch-wrapper]:cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:cursor-pointer [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-none [&::-moz-color-swatch]:cursor-pointer [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-none"
    />
  );
};
