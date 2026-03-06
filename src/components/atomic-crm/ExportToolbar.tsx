/**
 * ExportToolbar — PDF and Excel export for data grids.
 *
 * Uses pdfmake for PDF generation and exceljs for Excel (.xlsx) files.
 * Exports visible data with current filters applied.
 * Supports selecting sub-object fields from referenced entities (e.g. Contact → Company fields).
 */
import { useState, useCallback, useMemo, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { RaRecord } from "ra-core";

// ── Types ───────────────────────────────────────────────────

export interface ExportColumn {
  /** Column header label */
  label: string;
  /** Column source field */
  source: string;
  /** Column width for PDF (in pt). Default: auto */
  width?: number;
  /** Custom value formatter */
  format?: (value: unknown) => string;
}

/** Describes a reference relationship whose sub-fields can be included in export */
export interface ExportReferenceConfig {
  /** Foreign key field in the main record (e.g., "company_id") */
  foreignKey: string;
  /** Display label for the reference group (e.g., "Unternehmen") */
  label: string;
  /** The loaded reference data */
  data: RaRecord[];
  /** Available sub-fields the user can pick */
  fields: { source: string; label: string }[];
}

interface ExportToolbarProps {
  /** Column definitions for export */
  columns: ExportColumn[];
  /** Data rows */
  data: Record<string, unknown>[];
  /** Export filename (without extension) */
  filename?: string;
  /** Title for PDF header */
  title?: string;
  /** Description for PDF sub-header */
  description?: string;
  /** Reference configs for sub-object field selection */
  referenceConfigs?: ExportReferenceConfig[];
  /** localStorage key for persisting selected sub-fields */
  storeKey?: string;
}

// ── Helpers ─────────────────────────────────────────────────

function formatCellValue(value: unknown, col: ExportColumn): string {
  if (col.format) return col.format(value);
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ── PDF Export ──────────────────────────────────────────────

async function exportToPDF(
  columns: ExportColumn[],
  data: Record<string, unknown>[],
  title: string,
  description?: string,
) {
  const pdfMake = await import("pdfmake/build/pdfmake");
  const pdfFonts = await import("pdfmake/build/vfs_fonts");

  // Extract VFS fonts — handle varying export structures across pdfmake versions
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const pdfFontsAny = pdfFonts as any;
  const vfs: Record<string, string> =
    pdfFontsAny?.pdfMake?.vfs ??
    pdfFontsAny?.default?.pdfMake?.vfs ??
    pdfFontsAny?.default ??
    pdfFontsAny;

  // Use the same colour palette as the Excel export:
  // Header:  Magenta #A2007D   Alternating rows: light-blue #E6F3F8 / light-green #F2F7E6
  const tableHeaders = columns.map((col) => ({
    text: col.label,
    style: "tableHeader",
    fillColor: "#A2007D",
    color: "#ffffff",
    fontSize: 9,
    bold: true,
    margin: [4, 6, 4, 6] as [number, number, number, number],
  }));

  const tableRows = data.map((row, rowIndex) =>
    columns.map((col) => ({
      text: formatCellValue(getNestedValue(row, col.source), col),
      fontSize: 8,
      margin: [4, 3, 4, 3] as [number, number, number, number],
      fillColor: rowIndex % 2 === 0 ? "#E6F3F8" : "#F2F7E6",
    })),
  );

  const widths = columns.map((col) => col.width ? col.width : "*");

  const documentDefinition = {
    pageOrientation: "landscape" as const,
    pageMargins: [30, 40, 30, 40] as [number, number, number, number],
    content: [
      { text: title, style: "title" },
      ...(description ? [{ text: description, style: "subtitle" }] : []),
      {
        text: `Exportiert am ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date())} — ${data.length} Einträge`,
        style: "meta",
      },
      {
        table: {
          headerRows: 1,
          widths,
          body: [tableHeaders, ...tableRows],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#800063",
          vLineColor: () => "#800063",
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
    ],
    styles: {
      title: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] as [number, number, number, number] },
      subtitle: { fontSize: 10, color: "#666666", margin: [0, 0, 0, 4] as [number, number, number, number] },
      meta: { fontSize: 8, color: "#999999", margin: [0, 0, 0, 12] as [number, number, number, number] },
      tableHeader: {},
    },
    defaultStyle: {
      font: "Roboto",
    },
  };

  // pdfmake v0.3+ — the module default export is a singleton instance with createPdf()
  // We must call createPdf as a method to preserve `this` binding
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const pdfMakeInstance = (pdfMake.default || pdfMake) as any;

  // Set VFS fonts on the instance
  pdfMakeInstance.virtualfs = pdfMakeInstance.virtualfs || pdfMakeInstance.vfs;
  if (typeof pdfMakeInstance.addVirtualFileSystem === "function") {
    pdfMakeInstance.addVirtualFileSystem(vfs);
  } else if (pdfMakeInstance.virtualfs && typeof pdfMakeInstance.virtualfs.writeFileSync === "function") {
    for (const [filename, content] of Object.entries(vfs)) {
      pdfMakeInstance.virtualfs.writeFileSync(filename, content);
    }
  } else {
    pdfMakeInstance.vfs = vfs;
  }

  const pdf = pdfMakeInstance.createPdf(documentDefinition);
  await pdf.download(
    `${title.replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

// ── Excel Export ────────────────────────────────────────────

async function exportToExcel(
  columns: ExportColumn[],
  data: Record<string, unknown>[],
  title: string,
  filename: string,
) {
  const ExcelJS = await import("exceljs");
  const { saveAs } = await import("file-saver");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CRM Export";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(title.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // Header row
  worksheet.columns = columns.map((col) => ({
    header: col.label,
    key: col.source,
    width: col.width ? Math.round(col.width / 6) : 20,
  }));

  // Style header row — Magenta (#A2007D)
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFA2007D" },
    };
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 10,
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF800063" } },
      bottom: { style: "thin", color: { argb: "FF800063" } },
      left: { style: "thin", color: { argb: "FF800063" } },
      right: { style: "thin", color: { argb: "FF800063" } },
    };
  });

  // Data rows — alternating light-blue (#007CA2 → #E6F3F8) / light-green (#7CA200 → #F2F7E6)
  const altColors = ["FFE6F3F8", "FFF2F7E6"];
  let rowIndex = 0;
  for (const row of data) {
    const rowData: Record<string, string> = {};
    for (const col of columns) {
      rowData[col.source] = formatCellValue(getNestedValue(row, col.source), col);
    }
    const addedRow = worksheet.addRow(rowData);
    const bgColor = altColors[rowIndex % 2];
    addedRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: bgColor },
      };
      cell.font = { size: 9 };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFDEE2E6" } },
        left: { style: "thin", color: { argb: "FFDEE2E6" } },
        right: { style: "thin", color: { argb: "FFDEE2E6" } },
      };
    });
    rowIndex++;
  }

  // Auto-filter
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: data.length + 1, column: columns.length },
  };

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Sub-object data enrichment ─────────────────────────────

/** Enrich data rows with resolved sub-object fields */
function enrichDataWithSubFields(
  data: Record<string, unknown>[],
  referenceConfigs: ExportReferenceConfig[],
  selectedSubFields: Record<string, string[]>,
): Record<string, unknown>[] {
  // Build lookup maps
  const lookups = new Map<string, Map<unknown, RaRecord>>();
  for (const ref of referenceConfigs) {
    const map = new Map<unknown, RaRecord>();
    for (const record of ref.data) {
      map.set(record.id, record);
    }
    lookups.set(ref.foreignKey, map);
  }

  return data.map((row) => {
    const enriched = { ...row };
    for (const ref of referenceConfigs) {
      const selectedFields = selectedSubFields[ref.foreignKey] || [];
      if (selectedFields.length === 0) continue;
      const fkValue = row[ref.foreignKey];
      const refRecord = fkValue != null ? lookups.get(ref.foreignKey)?.get(fkValue) : undefined;
      for (const fieldSource of selectedFields) {
        const key = `__ref__${ref.foreignKey}__${fieldSource}`;
        enriched[key] = refRecord ? (refRecord as Record<string, unknown>)[fieldSource] ?? "-" : "-";
      }
    }
    return enriched;
  });
}

// ── Component ──────────────────────────────────────────────

export const ExportToolbar = ({
  columns,
  data,
  filename = "export",
  title = "Datenexport",
  description,
  referenceConfigs = [],
  storeKey,
}: ExportToolbarProps) => {
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const [expandedRefs, setExpandedRefs] = useState<Record<string, boolean>>({});

  // Persist selected sub-fields in localStorage
  const persistKey = storeKey ? `export_subfields_${storeKey}` : null;
  const [selectedSubFields, setSelectedSubFields] = useState<Record<string, string[]>>(() => {
    if (persistKey) {
      try {
        const saved = localStorage.getItem(persistKey);
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return {};
  });

  useEffect(() => {
    if (persistKey) {
      try {
        localStorage.setItem(persistKey, JSON.stringify(selectedSubFields));
      } catch { /* ignore */ }
    }
  }, [selectedSubFields, persistKey]);

  // Count total selected sub-fields
  const totalSubFields = useMemo(
    () => Object.values(selectedSubFields).reduce((sum, arr) => sum + arr.length, 0),
    [selectedSubFields],
  );

  // Build final columns + enriched data
  const finalColumns = useMemo(() => {
    if (totalSubFields === 0) return columns;
    const subCols = referenceConfigs.flatMap((ref) => {
      const selected = selectedSubFields[ref.foreignKey] || [];
      return ref.fields
        .filter((f) => selected.includes(f.source))
        .map((f) => ({
          source: `__ref__${ref.foreignKey}__${f.source}`,
          label: `${ref.label}: ${f.label}`,
        }));
    });
    return [...columns, ...subCols];
  }, [columns, referenceConfigs, selectedSubFields, totalSubFields]);

  const finalData = useMemo(() => {
    if (totalSubFields === 0) return data;
    return enrichDataWithSubFields(data, referenceConfigs, selectedSubFields);
  }, [data, referenceConfigs, selectedSubFields, totalSubFields]);

  // Toggle handlers
  const toggleRefExpanded = (fk: string) => {
    setExpandedRefs((prev) => ({ ...prev, [fk]: !prev[fk] }));
  };

  const toggleSubField = (fk: string, field: string) => {
    setSelectedSubFields((prev) => {
      const current = prev[fk] || [];
      const next = current.includes(field)
        ? current.filter((f) => f !== field)
        : [...current, field];
      return { ...prev, [fk]: next };
    });
  };

  const toggleAllSubFields = (fk: string, allFields: string[]) => {
    setSelectedSubFields((prev) => {
      const current = prev[fk] || [];
      const allSelected = allFields.every((f) => current.includes(f));
      return { ...prev, [fk]: allSelected ? [] : [...allFields] };
    });
  };

  const handlePDF = useCallback(async () => {
    setExporting("pdf");
    try {
      await exportToPDF(finalColumns, finalData, title, description);
    } catch (error) {
      console.error("PDF export failed:", error);
    } finally {
      setExporting(null);
    }
  }, [finalColumns, finalData, title, description]);

  const handleExcel = useCallback(async () => {
    setExporting("excel");
    try {
      await exportToExcel(finalColumns, finalData, title, filename);
    } catch (error) {
      console.error("Excel export failed:", error);
    } finally {
      setExporting(null);
    }
  }, [finalColumns, finalData, title, filename]);

  const hasRefs = referenceConfigs.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Export
          {totalSubFields > 0 && (
            <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
              +{totalSubFields}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={hasRefs ? "w-[300px] p-2" : "w-[200px] p-1"} align="end">
        {/* Reference sub-field selection */}
        {hasRefs && (
          <div className="mb-2">
            <div className="text-xs font-medium text-muted-foreground px-1 mb-1">
              Referenz-Felder einbeziehen
            </div>
            <div className="max-h-[200px] overflow-y-auto space-y-0.5">
              {referenceConfigs.map((ref) => {
                const selected = selectedSubFields[ref.foreignKey] || [];
                const isExpanded = expandedRefs[ref.foreignKey] ?? false;
                const allFields = ref.fields.map((f) => f.source);
                const allSelected = allFields.length > 0 && allFields.every((f) => selected.includes(f));
                const someSelected = selected.length > 0 && !allSelected;

                return (
                  <div key={ref.foreignKey} className="border rounded-md">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs font-medium hover:bg-accent rounded-md"
                      onClick={() => toggleRefExpanded(ref.foreignKey)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0" />
                      )}
                      <span className="flex-1 text-left">{ref.label}</span>
                      {selected.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {selected.length}/{allFields.length}
                        </span>
                      )}
                    </button>
                    {isExpanded && (
                      <div className="px-2 pb-2 space-y-1">
                        {/* Select all */}
                        <label className="flex items-center gap-2 text-xs cursor-pointer py-0.5 text-muted-foreground italic">
                          <Checkbox
                            checked={allSelected}
                            // @ts-expect-error indeterminate is valid
                            indeterminate={someSelected}
                            onCheckedChange={() => toggleAllSubFields(ref.foreignKey, allFields)}
                            className="h-3.5 w-3.5"
                          />
                          Alle auswählen
                        </label>
                        {ref.fields.map((field) => (
                          <label
                            key={field.source}
                            className="flex items-center gap-2 text-xs cursor-pointer py-0.5"
                          >
                            <Checkbox
                              checked={selected.includes(field.source)}
                              onCheckedChange={() => toggleSubField(ref.foreignKey, field.source)}
                              className="h-3.5 w-3.5"
                            />
                            {field.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="border-t mt-2 pt-1" />
          </div>
        )}

        {/* Export buttons */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sm gap-2 h-9"
          onClick={handlePDF}
          disabled={exporting !== null}
        >
          <FileText className="h-4 w-4 text-red-500" />
          PDF herunterladen
          {exporting === "pdf" && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sm gap-2 h-9"
          onClick={handleExcel}
          disabled={exporting !== null}
        >
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          Excel herunterladen
          {exporting === "excel" && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
        </Button>
        <div className="px-2 py-1 text-xs text-muted-foreground border-t mt-1 pt-1">
          {data.length} {data.length === 1 ? "Eintrag" : "Einträge"}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ExportToolbar;
