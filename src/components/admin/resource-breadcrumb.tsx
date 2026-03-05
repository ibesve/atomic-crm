/**
 * ra-navigation: Shadcn breadcrumb wrapper using ra-navigation's AppLocationContext.
 *
 * Provides auto-generated breadcrumbs for react-admin resources using
 * the Shadcn breadcrumb primitives.
 */
import { useResourceDefinitions, useTranslate, useCreatePath } from "ra-core";
import { Link, useLocation, useParams } from "react-router";
import {
  Breadcrumb as ShadcnBreadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";

export interface ResourceBreadcrumbProps {
  className?: string;
}

/**
 * Auto-generated breadcrumbs for react-admin routes.
 * Shows: Dashboard > Resource > Record
 */
export function ResourceBreadcrumb({ className }: ResourceBreadcrumbProps) {
  const location = useLocation();
  const params = useParams();
  const translate = useTranslate();
  const resourceDefs = useResourceDefinitions();
  const createPath = useCreatePath();

  // Parse current location to determine breadcrumb segments
  const pathParts = location.pathname.split("/").filter(Boolean);
  const segments: Array<{ label: string; path?: string }> = [];

  // Dashboard
  segments.push({
    label: translate("ra.page.dashboard", { _: "Dashboard" }),
    path: "/",
  });

  if (pathParts.length > 0) {
    const resourceName = pathParts[0];

    if (resourceDefs[resourceName]) {
      // Resource list
      segments.push({
        label: translate(`resources.${resourceName}.name`, {
          smart_count: 2,
          _: resourceName,
        }),
        path: pathParts.length > 1
          ? createPath({ resource: resourceName, type: "list" })
          : undefined,
      });

      // Record ID (show/edit)
      if (pathParts.length > 1 && pathParts[1] !== "create") {
        const id = pathParts[1];
        const action = pathParts[2]; // 'show' or undefined (which means show in our case)
        segments.push({
          label: `#${id}`,
          path: action ? createPath({ resource: resourceName, type: "show", id }) : undefined,
        });
      } else if (pathParts[1] === "create") {
        segments.push({
          label: translate("ra.action.create", { _: "Erstellen" }),
        });
      }
    } else {
      // Custom route - use path as label
      segments.push({
        label: translate(`crm.${resourceName}`, { _: resourceName }),
      });
    }
  }

  if (segments.length <= 1) return null;

  return (
    <ShadcnBreadcrumb className={className}>
      <BreadcrumbList>
        {segments.map((seg, idx) => {
          const isLast = idx === segments.length - 1;
          return (
            <span key={idx} className="flex items-center gap-1.5">
              {idx > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {isLast || !seg.path ? (
                  <BreadcrumbPage>
                    {idx === 0 ? <Home className="h-3.5 w-3.5" /> : seg.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={seg.path}>
                      {idx === 0 ? <Home className="h-3.5 w-3.5" /> : seg.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </ShadcnBreadcrumb>
  );
}

export default ResourceBreadcrumb;
