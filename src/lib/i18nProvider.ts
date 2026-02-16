import germanMessages from "ra-language-german";
import polyglotI18nProvider from "ra-i18n-polyglot";

export const i18nProvider = polyglotI18nProvider(
  () => germanMessages,
  "de",
  [{ name: "de", value: "Deutsch" }],
  { allowMissing: true },
);
