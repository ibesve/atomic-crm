/**
 * ra-tree: Tree view wrapper components.
 *
 * Re-exports the headless hooks for tree data management.
 * The actual tree UI can be rendered using Shadcn components with rc-tree.
 */

// Headless hooks
export {
  useGetTree,
  useGetRootNodes,
  useGetChildNodesCallback,
  useAddChildNode,
  useAddRootNode,
  useDeleteBranch,
  useMoveAsNthChildOf,
  useMoveAsNthSiblingOf,
} from "@react-admin/ra-tree";

// Builder
export { addTreeMethodsBasedOnParentAndPosition } from "@react-admin/ra-tree";

// Types
export type { TreeRecord, TreeDataProvider } from "@react-admin/ra-tree";
