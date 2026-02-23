import {
  Bell,
  Check,
  Languages,
  Link2,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Save,
  Settings,
  Sun,
} from "lucide-react";
import type { RaRecord } from "ra-core";
import {
  EditBase,
  Form,
  useGetList,
  useInput,
  useNotify,
  useTranslate,
} from "ra-core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { TextInput } from "@/components/admin/text-input";
import { ArrayInput } from "@/components/admin/array-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import ImageEditorField from "../misc/ImageEditorField";
import { RelationshipDefinitionManager } from "../custom-objects/RelationshipDefinitionManager";
import {
  useConfigurationContext,
  useConfigurationUpdater,
  type ConfigurationContextValue,
} from "../root/ConfigurationContext";
import { defaultConfiguration } from "../root/defaultConfiguration";
import { toSlug } from "@/lib/toSlug";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Theme hook
// ---------------------------------------------------------------------------

type Theme = "light" | "dark" | "system";

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
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
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

// ---------------------------------------------------------------------------
// User‑settings hook (notifications, language)
// ---------------------------------------------------------------------------

const useUserSettings = () => {
  const [settings, setSettings] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("userSettings");
      return saved
        ? JSON.parse(saved)
        : {
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

// ---------------------------------------------------------------------------
// SettingsPage (main export)
// ---------------------------------------------------------------------------

export const SettingsPage = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const updateConfiguration = useConfigurationUpdater();
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings } = useUserSettings();

  const handleNotificationChange = (key: string, value: boolean) => {
    updateSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        [key]: value,
      },
    });
    notify(
      translate("crm.settings.settings_saved", {
        _: "Einstellungen gespeichert",
      }),
    );
  };

  const handleLanguageChange = (value: string) => {
    updateSettings({
      ...settings,
      language: value,
    });
    notify(
      translate("crm.settings.language_changed", {
        _: "Sprache wurde geändert. Änderungen werden nach dem Neuladen wirksam.",
      }),
    );
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
            {translate("crm.settings.subtitle", {
              _: "Verwalten Sie Ihre Präferenzen und Konfiguration",
            })}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="configuration" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="configuration" className="gap-2">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">
              {translate("crm.settings.configuration", {
                _: "Konfiguration",
              })}
            </span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">
              {translate("crm.settings.notifications", {
                _: "Benachrichtigungen",
              })}
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
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="configuration">
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
            <ConfigurationForm />
          </EditBase>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                {translate("crm.settings.notification_preferences", {
                  _: "Benachrichtigungseinstellungen",
                })}
              </CardTitle>
              <CardDescription>
                {translate("crm.settings.notification_description", {
                  _: "Legen Sie fest, wie und wann Sie benachrichtigt werden möchten.",
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* E-Mail Notifications */}
              <div>
                <h3 className="text-lg font-medium mb-4">
                  {translate("crm.settings.email_notifications", {
                    _: "E-Mail-Benachrichtigungen",
                  })}
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailNewDeals">
                        {translate("crm.settings.new_deals", {
                          _: "Neue Deals",
                        })}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {translate("crm.settings.new_deals_description", {
                          _: "Erhalten Sie eine E-Mail, wenn ein neuer Deal erstellt wird.",
                        })}
                      </p>
                    </div>
                    <Switch
                      id="emailNewDeals"
                      checked={settings.notifications.emailNewDeals}
                      onCheckedChange={(value) =>
                        handleNotificationChange("emailNewDeals", value)
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailTaskReminders">
                        {translate("crm.settings.task_reminders", {
                          _: "Aufgaben-Erinnerungen",
                        })}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {translate("crm.settings.task_reminders_description", {
                          _: "Erhalten Sie Erinnerungen für anstehende Aufgaben.",
                        })}
                      </p>
                    </div>
                    <Switch
                      id="emailTaskReminders"
                      checked={settings.notifications.emailTaskReminders}
                      onCheckedChange={(value) =>
                        handleNotificationChange("emailTaskReminders", value)
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailWeeklyReport">
                        {translate("crm.settings.weekly_report", {
                          _: "Wöchentlicher Bericht",
                        })}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {translate("crm.settings.weekly_report_description", {
                          _: "Erhalten Sie eine wöchentliche Zusammenfassung Ihrer Aktivitäten.",
                        })}
                      </p>
                    </div>
                    <Switch
                      id="emailWeeklyReport"
                      checked={settings.notifications.emailWeeklyReport}
                      onCheckedChange={(value) =>
                        handleNotificationChange("emailWeeklyReport", value)
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Browser Notifications */}
              <div>
                <h3 className="text-lg font-medium mb-4">
                  {translate("crm.settings.browser_notifications", {
                    _: "Browser-Benachrichtigungen",
                  })}
                </h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="browserNotifications">
                      {translate(
                        "crm.settings.enable_browser_notifications",
                        { _: "Browser-Benachrichtigungen aktivieren" },
                      )}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {translate(
                        "crm.settings.browser_notifications_description",
                        {
                          _: "Erhalten Sie Desktop-Benachrichtigungen im Browser.",
                        },
                      )}
                    </p>
                  </div>
                  <Switch
                    id="browserNotifications"
                    checked={settings.notifications.browserNotifications}
                    onCheckedChange={(value) =>
                      handleNotificationChange("browserNotifications", value)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                {translate("crm.settings.appearance_settings", {
                  _: "Darstellungseinstellungen",
                })}
              </CardTitle>
              <CardDescription>
                {translate("crm.settings.appearance_description", {
                  _: "Passen Sie das Erscheinungsbild der Anwendung an.",
                })}
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
                    label={translate("crm.settings.theme_light", {
                      _: "Hell",
                    })}
                    description={translate(
                      "crm.settings.theme_light_description",
                      { _: "Helles Farbschema" },
                    )}
                  />
                  <ThemeOption
                    value="dark"
                    currentTheme={theme}
                    onSelect={setTheme}
                    icon={<Moon className="w-6 h-6" />}
                    label={translate("crm.settings.theme_dark", {
                      _: "Dunkel",
                    })}
                    description={translate(
                      "crm.settings.theme_dark_description",
                      { _: "Dunkles Farbschema" },
                    )}
                  />
                  <ThemeOption
                    value="system"
                    currentTheme={theme}
                    onSelect={setTheme}
                    icon={<Monitor className="w-6 h-6" />}
                    label={translate("crm.settings.theme_system", {
                      _: "System",
                    })}
                    description={translate(
                      "crm.settings.theme_system_description",
                      { _: "Automatisch" },
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Language Tab */}
        <TabsContent value="language">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="w-5 h-5" />
                {translate("crm.settings.language_settings", {
                  _: "Spracheinstellungen",
                })}
              </CardTitle>
              <CardDescription>
                {translate("crm.settings.language_description", {
                  _: "Wählen Sie Ihre bevorzugte Sprache für die Benutzeroberfläche.",
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="language" className="text-lg font-medium">
                  {translate("crm.settings.select_language", {
                    _: "Sprache auswählen",
                  })}
                </Label>
                <p className="text-sm text-muted-foreground mb-4">
                  {translate("crm.settings.language_info", {
                    _: "Weitere Sprachen werden in zukünftigen Updates verfügbar sein.",
                  })}
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
      </Tabs>
    </div>
  );
};

SettingsPage.path = "/settings";

// ---------------------------------------------------------------------------
// ThemeOption component
// ---------------------------------------------------------------------------

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
      <div
        className={`mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
      >
        {icon}
      </div>
      <span className={`font-medium ${isSelected ? "text-primary" : ""}`}>
        {label}
      </span>
      <span className="text-xs text-muted-foreground mt-1">{description}</span>
    </button>
  );
};

// ---------------------------------------------------------------------------
// Configuration form (EditBase child)
// ---------------------------------------------------------------------------

const SECTIONS = [
  { id: "branding", label: "Branding" },
  { id: "companies", label: "Companies" },
  { id: "deals", label: "Deals" },
  { id: "notes", label: "Notes" },
  { id: "tasks", label: "Tasks" },
  { id: "relationships", label: "Relationships" },
];

const ConfigurationForm = () => {
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

  return (
    <Form defaultValues={defaultValues}>
      <ConfigurationFormFields />
    </Form>
  );
};

const ConfigurationFormFields = () => {
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
    <div className="flex gap-8 mt-4 pb-20">
      {/* Left navigation */}
      <nav className="hidden md:block w-48 shrink-0">
        <div className="sticky top-4 space-y-1">
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
                <p className="text-sm text-muted-foreground">
                  Light Mode Logo
                </p>
                <ImageEditorField
                  source="lightModeLogo"
                  width={100}
                  height={100}
                  linkPosition="bottom"
                  backgroundImageColor="#f5f5f5"
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted-foreground">
                  Dark Mode Logo
                </p>
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
            <h3 className="text-lg font-medium text-muted-foreground">
              Types
            </h3>
            <ArrayInput source="taskTypes" label={false} helperText={false}>
              <SimpleFormIterator disableReordering disableClear>
                <TextInput source="label" label={false} />
              </SimpleFormIterator>
            </ArrayInput>
          </CardContent>
        </Card>

        {/* Relationships */}
        <Card id="relationships">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Relationships
            </h2>
            <RelationshipDefinitionManager />
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

// ---------------------------------------------------------------------------
// Color picker input
// ---------------------------------------------------------------------------

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
