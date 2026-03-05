/**
 * ra-enterprise: Enterprise Edition meta-package exports.
 *
 * The ra-enterprise package provides pre-configured Admin and Layout
 * components that bundle all EE features together.
 *
 * Note: We use our own Shadcn-based Admin and Layout, so we only
 * re-export the i18nProvider helper which merges all EE translations.
 */
export { i18nProvider as eeI18nProvider } from "@react-admin/ra-enterprise";
