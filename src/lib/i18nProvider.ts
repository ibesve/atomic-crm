import germanMessages from "ra-language-german";
import polyglotI18nProvider from "ra-i18n-polyglot";
import type { TranslationMessages } from "ra-core";

// TODO: Move these messages to ra-core when available in the next minor release.
// Remove this override once ra-core ships built-in guesser translations.
const guesserMessages = {
  guesser: {
    empty: {
      title: "No data to display",
      message: "Please check your data provider",
    },
  },
};

export const i18nProvider = polyglotI18nProvider(
  () => germanMessages,
  "de",
  [{ name: "de", value: "Deutsch" }],
  { allowMissing: true },
);
