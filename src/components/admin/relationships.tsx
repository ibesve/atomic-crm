/**
 * ra-relationships: Many-to-many relationships and dual-list input.
 *
 * Re-exports headless hooks and components for managing many-to-many relationships.
 *
 * Example usage:
 *   import { ReferenceManyToManyField, DualListInput } from "@/components/admin/relationships";
 *   <ReferenceManyToManyField reference="tags" through="contact_tags" using="contact_id,tag_id">
 *     <SingleFieldList>
 *       <ChipField source="name" />
 *     </SingleFieldList>
 *   </ReferenceManyToManyField>
 */
export {
  ReferenceManyToManyField,
  ReferenceManyToManyInput,
  DualListInput,
  ReferenceManyInput,
} from "@react-admin/ra-relationships";
