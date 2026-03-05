/**
 * ra-rbac: Role-Based Access Control components.
 *
 * Re-exports RBAC-aware versions of standard react-admin components.
 * These components automatically filter fields/actions based on user permissions.
 *
 * Example usage:
 *   import { List as RbacList, Datagrid as RbacDatagrid } from "@/components/admin/rbac";
 *   // Fields will be automatically shown/hidden based on permissions
 */

// RBAC-aware list components
export {
  List as RbacList,
  Datagrid as RbacDatagrid,
  ListActions as RbacListActions,
  ExportButton as RbacExportButton,
} from "@react-admin/ra-rbac";

// RBAC-aware show components
export {
  SimpleShowLayout as RbacSimpleShowLayout,
  TabbedShowLayout as RbacTabbedShowLayout,
  Tab as RbacTab,
} from "@react-admin/ra-rbac";

// RBAC-aware form components
export {
  SimpleForm as RbacSimpleForm,
  TabbedForm as RbacTabbedForm,
  FormTab as RbacFormTab,
} from "@react-admin/ra-rbac";

// RBAC-aware menu
export { Menu as RbacMenu } from "@react-admin/ra-rbac";
