/**
 * ra-form-layout: Enhanced form layout components.
 *
 * Re-exports AutoSave, dialog forms, accordion forms, wizard forms,
 * long forms, stacked filters, and bulk update forms.
 *
 * Example usage:
 *   import { AutoSave } from "@/components/admin/form-layout";
 *   <SimpleForm toolbar={<Toolbar><SaveButton /><AutoSave /></Toolbar>}>
 */

// Auto-save (works with any form)
export { AutoSave } from "@react-admin/ra-form-layout";

// Dialog form (edit-in-dialog pattern)
export {
  CreateInDialogButton,
  EditInDialogButton,
  ShowInDialogButton,
} from "@react-admin/ra-form-layout";

// Accordion form sections
export {
  AccordionForm,
  AccordionFormPanel,
} from "@react-admin/ra-form-layout";

// Wizard (multi-step) form
export {
  WizardForm,
  WizardFormStep,
} from "@react-admin/ra-form-layout";

// Long form with table of contents
export {
  LongForm,
  LongFormSection,
} from "@react-admin/ra-form-layout";

// Stacked filters
export { StackedFilters } from "@react-admin/ra-form-layout";

// Bulk update form
export { BulkUpdateFormButton } from "@react-admin/ra-form-layout";
