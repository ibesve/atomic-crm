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

  if (!identity) return null;

  const handleOnSubmit = async (values: any) => {
    mutate(values);
  };

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

  const handleClickOpenPasswordChange = () => {
    updatePassword();
  };

  const handleAvatarUpdate = async (values: any) => {
    mutateSale(values);
  };

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
            <Button
              type="button"
              variant={isEditMode ? "ghost" : "outline"}
              onClick={() => setEditMode(!isEditMode)}
              className="flex items-center"
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
  );
};

SettingsPage.path = "/settings";
