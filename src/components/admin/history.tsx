/**
 * ra-history: Version history and revision components.
 *
 * Re-exports revision viewer and form-with-revision components.
 * The hooks from ra-core-ee (useGetRevisions, useAddRevision) work with
 * our custom dataProvider.getRevisions/addRevision methods.
 *
 * Example usage:
 *   import { SimpleFormWithRevision, RevisionsButton } from "@/components/admin/history";
 */

// Revision viewing components
export {
  RevisionDetails,
  RevisionsButton as EERevisionsButton,
  RevisionList,
  RevisionListWithDetails,
} from "@react-admin/ra-history";

// Diff components
export {
  FieldDiff,
  SmartFieldDiff,
} from "@react-admin/ra-history";

// Form components with auto-revision creation
export {
  SimpleFormWithRevision,
  TabbedFormWithRevision,
  DeleteWithRevisionsButton,
} from "@react-admin/ra-history";
