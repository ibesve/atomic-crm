/**
 * useTransitiveReferences — Resolves A→B→C transitive reference chains.
 *
 * Given the current entity's reference fields (field defs pointing to target entities),
 * this hook looks one level deeper: for each referenced record (B), it finds reference
 * fields on entity B and resolves the next-hop labels (C).
 *
 * Returns a map of enriched labels: fieldDefId → { recordId → transitiveLabel }
 *
 * Limits:
 * - Max 1 level of transitivity (A → B → C, not deeper)
 * - Only discovers transitive refs on built-in entities (contacts, companies, deals, sales)
 *   and a single custom_* target (matching the existing pattern)
 */
import { useMemo } from "react";
import { useGetList } from "ra-core";
import type { RaRecord } from "ra-core";
import type { CustomFieldDefinition } from "@/components/atomic-crm/types/custom-objects";

// Built-in reference fields on each entity
const BUILTIN_REFS: Record<string, { field: string; target: string; label: string }[]> = {
  contacts: [
    { field: "company_id", target: "companies", label: "Unternehmen" },
    { field: "sales_id", target: "sales", label: "Vertrieb" },
  ],
  companies: [
    { field: "sales_id", target: "sales", label: "Vertrieb" },
  ],
  deals: [
    { field: "company_id", target: "companies", label: "Unternehmen" },
    { field: "sales_id", target: "sales", label: "Vertrieb" },
  ],
  sales: [],
};

interface TransitiveRef {
  /** The field on entity B that references entity C */
  throughField: string;
  /** Human-readable label for the through-field */
  throughLabel: string;
  /** The target entity C */
  targetEntity: string;
  /** The display value from entity C */
  displayValue: string;
}

export interface TransitiveResult {
  /** Map: fieldDefId → { referencedRecordId → TransitiveRef[] } */
  transitiveMap: Record<string, Record<string, TransitiveRef[]>>;
  /** Formatted string helper: fieldDefId → recordId → "B-label (→ C-label)" */
  getEnrichedLabel: (
    fieldDefId: number | string,
    referencedRecordId: number | string,
    baseLabel: string,
  ) => string;
  isLoading: boolean;
}

function getRecordLabel(target: string, r: RaRecord): string {
  if (target === "contacts" || target === "sales") {
    return [r.first_name, r.last_name].filter(Boolean).join(" ") || `#${r.id}`;
  }
  return String(r.name || r.title || r.label || `#${r.id}`);
}

/**
 * Hook to resolve transitive references.
 *
 * @param fieldDefs The current entity's reference-type field definitions
 * @param refDataMap Already-loaded reference data: { target: RaRecord[] }
 */
export function useTransitiveReferences(
  fieldDefs: CustomFieldDefinition[] | undefined,
  refDataMap: Record<string, RaRecord[]>,
): TransitiveResult {
  // Find all first-hop targets and what second-hop targets they need
  const secondHopTargets = useMemo(() => {
    if (!fieldDefs) return new Set<string>();
    const targets = new Set<string>();
    for (const fd of fieldDefs) {
      if (fd.field_type !== "reference" || !fd.reference_object) continue;
      const target = fd.reference_object;
      const builtinRefs = BUILTIN_REFS[target];
      if (builtinRefs) {
        for (const br of builtinRefs) {
          targets.add(br.target);
        }
      }
      // For custom_* targets, we'd need to load their field defs — not supported yet
    }
    return targets;
  }, [fieldDefs]);

  // Load second-hop reference data (only built-in entities)
  const needCompanies = secondHopTargets.has("companies");
  const needSales = secondHopTargets.has("sales");
  const needContacts = secondHopTargets.has("contacts");
  const needDeals = secondHopTargets.has("deals");

  const { data: hopCompanies, isLoading: l1 } = useGetList("companies", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "name", order: "ASC" },
    filter: needCompanies ? {} : { id: -1 },
  });
  const { data: hopSales, isLoading: l2 } = useGetList("sales", {
    pagination: { page: 1, perPage: 200 },
    sort: { field: "last_name", order: "ASC" },
    filter: needSales ? {} : { id: -1 },
  });
  const { data: hopContacts, isLoading: l3 } = useGetList("contacts", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "last_name", order: "ASC" },
    filter: needContacts ? {} : { id: -1 },
  });
  const { data: hopDeals, isLoading: l4 } = useGetList("deals", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "name", order: "ASC" },
    filter: needDeals ? {} : { id: -1 },
  });

  // Build second-hop lookup: target → { id → RaRecord }
  const secondHopLookup = useMemo(() => {
    const map: Record<string, Record<string, RaRecord>> = {};
    const addAll = (key: string, records: RaRecord[] | undefined) => {
      if (!records) return;
      map[key] = {};
      for (const r of records) map[key][String(r.id)] = r;
    };
    addAll("companies", hopCompanies);
    addAll("sales", hopSales);
    addAll("contacts", hopContacts);
    addAll("deals", hopDeals);
    return map;
  }, [hopCompanies, hopSales, hopContacts, hopDeals]);

  // Build transitive map
  const transitiveMap = useMemo(() => {
    const result: Record<string, Record<string, TransitiveRef[]>> = {};
    if (!fieldDefs) return result;

    for (const fd of fieldDefs) {
      if (fd.field_type !== "reference" || !fd.reference_object) continue;
      const target = fd.reference_object;
      const builtinRefs = BUILTIN_REFS[target];
      if (!builtinRefs || builtinRefs.length === 0) continue;

      const refRecords = refDataMap[target] || [];
      const fieldMap: Record<string, TransitiveRef[]> = {};

      for (const refRec of refRecords) {
        const refs: TransitiveRef[] = [];
        for (const br of builtinRefs) {
          const foreignId = refRec[br.field];
          if (!foreignId) continue;
          const hopLookup = secondHopLookup[br.target];
          if (!hopLookup) continue;
          const hopRecord = hopLookup[String(foreignId)];
          if (!hopRecord) continue;
          refs.push({
            throughField: br.field,
            throughLabel: br.label,
            targetEntity: br.target,
            displayValue: getRecordLabel(br.target, hopRecord),
          });
        }
        if (refs.length > 0) {
          fieldMap[String(refRec.id)] = refs;
        }
      }

      if (Object.keys(fieldMap).length > 0) {
        result[String(fd.id)] = fieldMap;
      }
    }
    return result;
  }, [fieldDefs, refDataMap, secondHopLookup]);

  const getEnrichedLabel = (
    fieldDefId: number | string,
    referencedRecordId: number | string,
    baseLabel: string,
  ): string => {
    const fieldMap = transitiveMap[String(fieldDefId)];
    if (!fieldMap) return baseLabel;
    const refs = fieldMap[String(referencedRecordId)];
    if (!refs || refs.length === 0) return baseLabel;
    const extras = refs.map((r) => `${r.throughLabel}: ${r.displayValue}`).join(", ");
    return `${baseLabel} (${extras})`;
  };

  return {
    transitiveMap,
    getEnrichedLabel,
    isLoading: l1 || l2 || l3 || l4,
  };
}
