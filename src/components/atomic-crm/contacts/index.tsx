import type { Contact } from "../types";
import { ContactCreate } from "./ContactCreate";
import { ContactEdit } from "./ContactEdit";
import { ContactList } from "./ContactList";
import { ContactShow } from "./ContactShow";
import { ContactDataGrid } from "./ContactDataGrid";

export { ContactDataGrid };

export default {
  list: ContactList,
  show: ContactShow,
  edit: ContactEdit,
  create: ContactCreate,
  recordRepresentation: (record: Contact) =>
    record?.first_name + " " + record?.last_name,
};
