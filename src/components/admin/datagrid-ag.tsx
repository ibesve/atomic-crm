/**
 * ra-datagrid-ag: AG Grid datagrid wrapper.
 *
 * Re-exports the DatagridAG and DatagridAGClient components.
 * AG Grid Community edition is MIT licensed.
 *
 * Example usage:
 *   import { DatagridAG } from "@/components/admin/datagrid-ag";
 *   <List>
 *     <DatagridAG columnDefs={columnDefs} />
 *   </List>
 */
export { DatagridAG, DatagridAGClient } from "@react-admin/ra-datagrid-ag";
export { useDatagridAGController } from "@react-admin/ra-datagrid-ag";
export type { DatagridAGProps } from "@react-admin/ra-datagrid-ag";
