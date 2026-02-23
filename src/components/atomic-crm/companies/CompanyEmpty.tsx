import { CreateButton } from "@/components/admin/create-button";
import { useTranslate } from "ra-core";
import useAppBarHeight from "../misc/useAppBarHeight";

export const CompanyEmpty = () => {
  const appbarHeight = useAppBarHeight();
  const translate = useTranslate();
  
  return (
    <div
      className="flex flex-col justify-center items-center gap-6"
      style={{
        height: `calc(100dvh - ${appbarHeight}px)`,
      }}
    >
      <img src="./img/empty.svg" alt={translate("crm.no_companies_found")} />
      <div className="flex flex-col gap-0 items-center">
        <h6 className="text-lg font-bold">{translate("crm.no_companies_found")}</h6>
        <p className="text-sm text-center text-muted-foreground mb-4">
          {translate("crm.company_list_empty")}
        </p>
      </div>
      <div className="flex space-x-2">
        <CreateButton label={translate("crm.create_company")} />
      </div>
    </div>
  );
};
