import { useTranslate } from "ra-core";
import { History, Shield } from "lucide-react";
import { AuditLogViewer } from "@/components/atomic-crm/audit/AuditLogViewer";

export function AuditLogPage() {
  const translate = useTranslate();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {translate("crm.audit_log.page_title", { _: "Änderungsprotokoll" })}
          </h1>
          <p className="text-muted-foreground">
            {translate("crm.audit_log.page_description", { 
              _: "Alle Änderungen an Kontakten, Unternehmen und Deals nachverfolgen" 
            })}
          </p>
        </div>
      </div>

      <AuditLogViewer 
        showFilters={true}
        maxHeight="calc(100vh - 250px)"
      />
    </div>
  );
}

export default AuditLogPage;
