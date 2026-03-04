import { useTranslate } from "ra-core";
import {
  List,
  Datagrid,
  TextField,
  EditButton,
  DeleteButton,
  Create,
  Edit,
  SimpleForm,
  TextInput,
  required,
} from "react-admin";

export const RoleList = () => {
  const translate = useTranslate();
  return (
    <List>
      <Datagrid rowClick="edit">
        <TextField source="name" label={translate("crm.rbac.role_name")} />
        <TextField source="description" label={translate("crm.rbac.description")} />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
};

export const RoleCreate = () => {
  const translate = useTranslate();
  return (
    <Create>
      <SimpleForm>
        <TextInput source="name" label={translate("crm.rbac.role_name")} validate={required()} />
        <TextInput source="description" label={translate("crm.rbac.description")} multiline />
      </SimpleForm>
    </Create>
  );
};

export const RoleEdit = () => {
  const translate = useTranslate();
  return (
    <Edit>
      <SimpleForm>
        <TextInput source="name" label={translate("crm.rbac.role_name")} validate={required()} />
        <TextInput source="description" label={translate("crm.rbac.description")} multiline />
      </SimpleForm>
    </Edit>
  );
};

export default {
  list: RoleList,
  create: RoleCreate,
  edit: RoleEdit,
};
