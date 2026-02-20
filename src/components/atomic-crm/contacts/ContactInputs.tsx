import { email, required } from "ra-core";
import type { FocusEvent, ClipboardEventHandler } from "react";
import { useFormContext } from "react-hook-form";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { BooleanInput } from "@/components/admin/boolean-input";
import { TextInput } from "@/components/admin/text-input";
import { RadioButtonGroupInput } from "@/components/admin/radio-button-group-input";
import { SelectInput } from "@/components/admin/select-input";
import { ArrayInput } from "@/components/admin/array-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { ReferenceInputWithCreate } from "@/components/admin/reference-input-with-create";
import { isLinkedinUrl } from "../misc/isLinkedInUrl";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { Avatar } from "./Avatar";
import { useState, useEffect, useCallback } from "react";

export const ContactInputs = () => {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col gap-2 p-1 relative md:static">
      <div className="absolute top-0 right-1 md:static">
        <Avatar />
      </div>
      <div className="flex gap-10 md:gap-6 flex-col md:flex-row">
        <div className="flex flex-col gap-10 flex-1">
          <ContactIdentityInputs />
          <ContactPositionInputs />
        </div>
        {isMobile ? null : (
          <Separator orientation="vertical" className="flex-shrink-0" />
        )}
        <div className="flex flex-col gap-10 flex-1">
          <ContactPersonalInformationInputs />
          <ContactMiscInputs />
        </div>
      </div>
    </div>
  );
};

const ContactIdentityInputs = () => {
  const { contactGender } = useConfigurationContext();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Identität</h6>
      <RadioButtonGroupInput
        label={false}
        row
        source="gender"
        choices={contactGender}
        helperText={false}
        optionText="label"
        optionValue="value"
        defaultValue={contactGender[0].value}
      />
      <TextInput source="first_name" validate={required()} helperText={false} />
      <TextInput source="last_name" validate={required()} helperText={false} />
    </div>
  );
};

const ContactPositionInputs = () => {
  const { setValue, watch, getValues } = useFormContext();
  const { companySectors } = useConfigurationContext();
  
  // Verwende getValues für den initialen Wert, nicht watch
  const [companyId, setCompanyId] = useState<number | null>(() => getValues("company_id") ?? null);

  // Synchronisiere mit dem Formular wenn sich der Wert extern ändert
  const watchedCompanyId = watch("company_id");
  useEffect(() => {
    if (watchedCompanyId !== undefined && watchedCompanyId !== companyId) {
      setCompanyId(watchedCompanyId);
    }
  }, [watchedCompanyId, companyId]);

  const handleCompanyChange = useCallback((value: number | string | null) => {
    // Company changed
    setCompanyId(value as number | null);
    setValue("company_id", value, { shouldDirty: true, shouldValidate: true, shouldTouch: true });
  }, [setValue]);

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Position</h6>
      <TextInput source="title" helperText={false} label="Titel / Position" />
      
      {/* Unternehmen mit Nested Create Form */}
      <ReferenceInputWithCreate
        source="company_id"
        reference="companies"
        label="Unternehmen"
        optionText="name"
        value={companyId}
        onChange={handleCompanyChange}
        createTitle="Neues Unternehmen erstellen"
        createFields={[
          {
            source: "name",
            label: "Firmenname",
            type: "text",
            required: true,
            placeholder: "z.B. Musterfirma GmbH",
          },
          {
            source: "sector",
            label: "Branche",
            type: "select",
            options: companySectors.map((s) => ({ value: s, label: s })),
          },
          {
            source: "website",
            label: "Website",
            type: "text",
            placeholder: "https://...",
          },
          {
            source: "phone_number",
            label: "Telefon",
            type: "tel",
          },
          {
            source: "address",
            label: "Adresse",
            type: "text",
          },
          {
            source: "city",
            label: "Stadt",
            type: "text",
          },
          {
            source: "zipcode",
            label: "PLZ",
            type: "text",
          },
        ]}
      />
    </div>
  );
};

const ContactPersonalInformationInputs = () => {
  const { getValues, setValue } = useFormContext();

  const handleEmailChange = (email: string) => {
    const { first_name, last_name } = getValues();
    if (first_name || last_name || !email) return;
    const [first, last] = email.split("@")[0].split(".");
    setValue("first_name", first.charAt(0).toUpperCase() + first.slice(1));
    setValue(
      "last_name",
      last ? last.charAt(0).toUpperCase() + last.slice(1) : "",
    );
  };

  const handleEmailPaste: ClipboardEventHandler<
    HTMLTextAreaElement | HTMLInputElement
  > = (e) => {
    const email = e.clipboardData?.getData("text/plain");
    handleEmailChange(email);
  };

  const handleEmailBlur = (
    e: FocusEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    const email = e.target.value;
    handleEmailChange(email);
  };

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Kontaktdaten</h6>
      <ArrayInput
        source="email_jsonb"
        label="E-Mail-Adressen"
        helperText={false}
      >
        <SimpleFormIterator
          inline
          disableReordering
          disableClear
          className="[&>ul>li]:border-b-0 [&>ul>li]:pb-0"
        >
          <TextInput
            source="email"
            className="w-full"
            helperText={false}
            label={false}
            placeholder="E-Mail"
            validate={email()}
            onPaste={handleEmailPaste}
            onBlur={handleEmailBlur}
          />
          <SelectInput
            source="type"
            helperText={false}
            label={false}
            optionText="id"
            choices={personalInfoTypes}
            defaultValue="Work"
            className="w-24 min-w-24"
          />
        </SimpleFormIterator>
      </ArrayInput>
      <ArrayInput source="phone_jsonb" label="Telefonnummern" helperText={false}>
        <SimpleFormIterator
          inline
          disableReordering
          disableClear
          className="[&>ul>li]:border-b-0 [&>ul>li]:pb-0"
        >
          <TextInput
            source="number"
            className="w-full"
            helperText={false}
            label={false}
            placeholder="Telefonnummer"
          />
          <SelectInput
            source="type"
            helperText={false}
            label={false}
            optionText="id"
            choices={personalInfoTypes}
            defaultValue="Work"
            className="w-24 min-w-24"
          />
        </SimpleFormIterator>
      </ArrayInput>
      <TextInput
        source="linkedin_url"
        label="LinkedIn URL"
        helperText={false}
        validate={isLinkedinUrl}
      />
    </div>
  );
};

const personalInfoTypes = [
  { id: "Work", label: "Arbeit" },
  { id: "Home", label: "Privat" },
  { id: "Other", label: "Sonstige" },
];

const ContactMiscInputs = () => {
  const { setValue, watch } = useFormContext();
  const salesId = watch("sales_id");

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Sonstiges</h6>
      <TextInput
        source="background"
        label="Hintergrundinformationen"
        multiline
        helperText={false}
      />
      <BooleanInput source="has_newsletter" label="Newsletter" helperText={false} />
      
      {/* Kundenbetreuer mit Nested Create */}
      <ReferenceInputWithCreate
        source="sales_id"
        reference="sales"
        label="Kundenbetreuer"
        optionText={(record) => `${record.first_name} ${record.last_name}`}
        value={salesId}
        onChange={(value) => setValue("sales_id", value, { shouldDirty: true, shouldValidate: true })}
        createTitle="Neuen Benutzer erstellen"
        allowCreate={false} // Benutzer sollten über die Benutzerverwaltung erstellt werden
        createFields={[
          {
            source: "first_name",
            label: "Vorname",
            type: "text",
            required: true,
          },
          {
            source: "last_name",
            label: "Nachname",
            type: "text",
            required: true,
          },
          {
            source: "email",
            label: "E-Mail",
            type: "email",
            required: true,
          },
        ]}
      />
    </div>
  );
};
