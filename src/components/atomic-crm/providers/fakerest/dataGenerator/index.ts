import { generateCompanies } from "./companies";
import { generateContactNotes } from "./contactNotes";
import { generateContacts } from "./contacts";
import { generateDealNotes } from "./dealNotes";
import { generateDeals } from "./deals";
import { finalize } from "./finalize";
import { generateSales } from "./sales";
import { generateTags } from "./tags";
import { generateTasks } from "./tasks";
import type { Db } from "./types";

export default (): Db => {
  const db = {} as Db;
  db.sales = generateSales(db);
  db.tags = generateTags(db);
  db.companies = generateCompanies(db);
  db.contacts = generateContacts(db);
  db.contact_notes = generateContactNotes(db);
  db.deals = generateDeals(db);
  db.deal_notes = generateDealNotes(db);
  db.tasks = generateTasks(db);
  db.configuration = [
    {
      id: 1,
      config: {} as Db["configuration"][number]["config"],
    },
  ];
  // RBAC
  db.roles = [];
  db.role_permissions = [];
  db.teams = [];
  db.team_members = [];
  db.user_roles = [];
  db.team_roles = [];
  // ABAC
  db.attribute_definitions = [];
  db.user_attributes = [];
  db.permission_conditions = [];
  // Custom Objects
  db.custom_object_definitions = [];
  db.custom_field_definitions = [];
  db.custom_field_values = [];
  db.custom_object_data = [];
  db.object_relationships = [];
  db.relationship_definitions = [];
  // Audit
  db.audit_logs = [];
  db.record_versions = [];
  finalize(db);

  return db;
};
