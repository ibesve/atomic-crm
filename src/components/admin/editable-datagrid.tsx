import { ReactNode, useState, useCallback, useEffect, useMemo } from "react";
import {
  useGetList,
  useNotify,
  useTranslate,
  RecordContextProvider,
  RaRecord,
} from "ra-core";
import { Link } from "react-router";
import {
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Filter,
  Columns,
  GripVertical,
  RotateCcw,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { EditableCell } from "./editable-cell";
import { useSoftDelete } from "@/hooks/use-soft-delete";

export interface EditableColumnDef<RecordType extends RaRecord = RaRecord> {
  source: string;
  label: string;
  editable?: boolean;
  type?: "text" | "number" | "select" | "reference";
  options?: { value: string; label: string }[];
  referenceResource?: string;
  referenceData?: RaRecord[]; // NEU: Referenzdaten können direkt übergeben werden
  render?: (record: RecordType) => ReactNode;
  renderLink?: boolean;
  linkPath?: (record: RecordType) => string;
  sortable?: boolean;
  filterable?: boolean;
  defaultHidden?: boolean;
  width?: string;
}

interface DataGridState {
  columnOrder: string[];
  hiddenColumns: string[];
  sort: { field: string; order: "ASC" | "DESC" };
  showDeleted: boolean;
}

interface EditableDataGridProps<RecordType extends RaRecord = RaRecord> {
  columns: EditableColumnDef<RecordType>[];
  resource: string;
  defaultSort?: { field: string; order: "ASC" | "DESC" };
  onCreate?: () => void;
  bulkActions?: boolean;
  className?: string;
  storeKey?: string;
  enableSoftDelete?: boolean;
}

export function EditableDataGrid<RecordType extends RaRecord = RaRecord>({
  columns,
  resource,
  defaultSort = { field: "id", order: "DESC" },
  onCreate,
  bulkActions = true,
  className,
  storeKey,
  enableSoftDelete = true,
}: EditableDataGridProps<RecordType>) {
  const translate = useTranslate();
  const notify = useNotify();
  const { softDelete, restore, bulkSoftDelete, bulkRestore } = useSoftDelete(resource);
  
  const storageKey = storeKey || `datagrid_${resource}`;
  
  const loadState = useCallback((): DataGridState => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          columnOrder: parsed.columnOrder || columns.map(c => c.source),
          hiddenColumns: parsed.hiddenColumns || columns.filter(c => c.defaultHidden).map(c => c.source),
          sort: parsed.sort || defaultSort,
          showDeleted: parsed.showDeleted || false,
        };
      }
    } catch (e) {
      console.error("Error loading datagrid state:", e);
    }
    return {
      columnOrder: columns.map(c => c.source),
      hiddenColumns: columns.filter(c => c.defaultHidden).map(c => c.source),
      sort: defaultSort,
      showDeleted: false,
    };
  }, [columns, defaultSort, storageKey]);

  const [state, setState] = useState<DataGridState>(loadState);
  
  // Synchronisiere columnOrder mit den aktuellen Spalten (füge neue hinzu, entferne alte)
  useEffect(() => {
    const currentSources = columns.map(c => c.source);
    const hasNewColumns = currentSources.some(s => !state.columnOrder.includes(s));
    const hasRemovedColumns = state.columnOrder.some(s => !currentSources.includes(s));
    
    if (hasNewColumns || hasRemovedColumns) {
      setState(prev => {
        // Behalte die Reihenfolge der existierenden Spalten
        const validOrder = prev.columnOrder.filter(s => currentSources.includes(s));
        // Füge neue Spalten am Ende hinzu
        const newSources = currentSources.filter(s => !prev.columnOrder.includes(s));
        return {
          ...prev,
          columnOrder: [...validOrder, ...newSources],
        };
      });
    }
  }, [columns, state.columnOrder]);

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<RecordType | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (e) {
      console.error("Error saving datagrid state:", e);
    }
  }, [state, storageKey]);

  // Build filter based on soft delete state
  const buildFilter = useCallback(() => {
    const baseFilter = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v !== "")
    );
    
    // Wenn showDeleted false ist, nur nicht-gelöschte anzeigen
    if (enableSoftDelete && !state.showDeleted) {
      return { ...baseFilter, "deleted_at@is": "null" };
    }
    
    return baseFilter;
  }, [filters, state.showDeleted, enableSoftDelete]);

  const { data, isPending, total } = useGetList<RecordType>(resource, {
    pagination: { page: 1, perPage: 100 },
    sort: state.sort,
    filter: buildFilter(),
  });

  // Count deleted items
  const { total: deletedCount } = useGetList<RecordType>(resource, {
    pagination: { page: 1, perPage: 1 },
    filter: { "deleted_at@not.is": "null" },
  });

  // Referenzdaten direkt aus den Column-Definitionen holen (keine Hooks mehr in der map!)
  const getReferenceData = useCallback((col: EditableColumnDef<RecordType>) => {
    // Wenn referenceData direkt in der Column-Definition übergeben wurde, nutze diese
    if (col.referenceData) {
      return col.referenceData;
    }
    return [];
  }, []);

  const handleSort = useCallback((field: string) => {
    setState((prev) => ({
      ...prev,
      sort: {
        field,
        order: prev.sort.field === field && prev.sort.order === "ASC" ? "DESC" : "ASC",
      },
    }));
  }, []);

  const toggleColumn = useCallback((source: string) => {
    setState((prev) => ({
      ...prev,
      hiddenColumns: prev.hiddenColumns.includes(source)
        ? prev.hiddenColumns.filter((c) => c !== source)
        : [...prev.hiddenColumns, source],
    }));
  }, []);

  const toggleShowDeleted = useCallback(() => {
    setState((prev) => ({ ...prev, showDeleted: !prev.showDeleted }));
    setSelectedIds([]);
  }, []);

  // Drag & Drop Handlers
  const handleDragStart = useCallback((e: React.DragEvent, source: string) => {
    setDraggedColumn(source);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", source);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, source: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedColumn && draggedColumn !== source) {
      setDragOverColumn(source);
    }
  }, [draggedColumn]);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetSource: string) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetSource) {
      setDraggedColumn(null);
      setDragOverColumn(null);
      return;
    }
    setState((prev) => {
      const newOrder = [...prev.columnOrder];
      const draggedIndex = newOrder.indexOf(draggedColumn);
      const targetIndex = newOrder.indexOf(targetSource);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedColumn);
      }
      
      return { ...prev, columnOrder: newOrder };
    });
    setDraggedColumn(null);
    setDragOverColumn(null);
  }, [draggedColumn]);

  const handleDragEnd = useCallback(() => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  }, []);

  const resetColumnOrder = useCallback(() => {
    setState((prev) => ({
      ...prev,
      columnOrder: columns.map(c => c.source),
      hiddenColumns: columns.filter(c => c.defaultHidden).map(c => c.source),
    }));
    notify(translate("ra.message.settings_reset", { _: "Einstellungen zurückgesetzt" }), { type: "info" });
  }, [columns, notify, translate]);

  const toggleSelectAll = useCallback(() => {
    if (!data) return;
    if (selectedIds.length === data.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.map((r) => r.id));
    }
  }, [data, selectedIds]);

  const toggleSelect = useCallback((id: string | number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  // Delete handler - uses soft delete
  const handleDelete = useCallback(
    async (record: RecordType) => {
      if (enableSoftDelete) {
        await softDelete(record.id);
      }
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    },
    [enableSoftDelete, softDelete]
  );

  // Restore handler
  const handleRestore = useCallback(
    async (record: RecordType) => {
      await restore(record.id);
    },
    [restore]
  );

  // Bulk delete - uses soft delete
  const handleBulkDelete = useCallback(async () => {
    if (enableSoftDelete) {
      await bulkSoftDelete(selectedIds);
    }
    setSelectedIds([]);
    setDeleteDialogOpen(false);
  }, [selectedIds, enableSoftDelete, bulkSoftDelete]);

  // Bulk restore
  const handleBulkRestore = useCallback(async () => {
    await bulkRestore(selectedIds);
    setSelectedIds([]);
  }, [selectedIds, bulkRestore]);

  const orderedColumns = useMemo(() => {
    // Erst die Spalten aus columnOrder holen, die auch in columns existieren
    const orderedFromState = state.columnOrder
      .map(source => columns.find(c => c.source === source))
      .filter((col): col is EditableColumnDef<RecordType> => col !== undefined);
    
    // Dann neue Spalten hinzufügen, die noch nicht in columnOrder sind
    const newColumns = columns.filter(
      col => !state.columnOrder.includes(col.source)
    );
    
    // Kombinieren und versteckte Spalten herausfiltern
    return [...orderedFromState, ...newColumns]
      .filter(col => !state.hiddenColumns.includes(col.source));
  }, [state.columnOrder, state.hiddenColumns, columns]);

  // Check if record is deleted
  const isDeleted = (record: RecordType) => {
    return enableSoftDelete && (record as any).deleted_at !== null;
  };

  return (
    <Card className={cn("p-4", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={translate("ra.action.search")}
              className="pl-9"
              onChange={(e) => setFilters({ q: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Show deleted toggle */}
          {enableSoftDelete && (
            <Button
              variant={state.showDeleted ? "secondary" : "outline"}
              size="sm"
              onClick={toggleShowDeleted}
              className={cn(state.showDeleted && "border-red-300")}
            >
              {state.showDeleted ? (
                <EyeOff className="h-4 w-4 mr-2" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              {state.showDeleted 
                ? translate("crm.soft_delete.hide_deleted", { _: "Gelöschte ausblenden" })
                : translate("crm.soft_delete.show_deleted", { _: "Gelöschte anzeigen" })
              }
              {deletedCount && deletedCount > 0 && !state.showDeleted && (
                <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                  {deletedCount}
                </Badge>
              )}
            </Button>
          )}

          {/* Column selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns className="h-4 w-4 mr-2" />
                {translate("ra.action.toggle_columns", { _: "Spalten" })}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
              {columns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.source}
                  checked={!state.hiddenColumns.includes(col.source)}
                  onCheckedChange={() => toggleColumn(col.source)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
              <div className="border-t my-1" />
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start text-xs"
                onClick={resetColumnOrder}
              >
                {translate("ra.action.reset", { _: "Zurücksetzen" })}
              </Button>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Bulk actions */}
          {bulkActions && selectedIds.length > 0 && (
            <>
              {state.showDeleted ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkRestore}
                  className="border-green-300 text-green-700 hover:bg-green-50"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {translate("crm.soft_delete.restore", { _: "Wiederherstellen" })} ({selectedIds.length})
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {translate("ra.action.delete")} ({selectedIds.length})
                </Button>
              )}
            </>
          )}

          {/* Create button */}
          {onCreate && (
            <Button size="sm" onClick={onCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {translate("ra.action.create")}
            </Button>
          )}
        </div>
      </div>

      {/* Hint für Drag & Drop */}
      <p className="text-xs text-muted-foreground mb-2">
        {translate("crm.drag_columns_hint", { _: "💡 Spaltenköpfe per Drag & Drop verschieben" })}
      </p>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {bulkActions && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={data?.length ? selectedIds.length === data.length : false}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              {orderedColumns.map((col) => (
                <TableHead
                  key={col.source}
                  draggable
                  onDragStart={(e) => handleDragStart(e, col.source)}
                  onDragOver={(e) => handleDragOver(e, col.source)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.source)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "cursor-grab select-none transition-colors",
                    col.sortable !== false && "cursor-grab",
                    draggedColumn === col.source && "opacity-50 bg-muted",
                    dragOverColumn === col.source && "bg-primary/10 border-l-2 border-primary"
                  )}
                  style={{ width: col.width }}
                >
                  <div 
                    className="flex items-center gap-1"
                    onClick={() => col.sortable !== false && handleSort(col.source)}
                  >
                    <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                    <span className="flex-1">{col.label}</span>
                    {state.sort.field === col.source && (
                      state.sort.order === "ASC" ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )
                    )}
                  </div>
                </TableHead>
              ))}
              <TableHead className="w-12">{/* Actions */}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell
                  colSpan={orderedColumns.length + (bulkActions ? 2 : 1)}
                  className="text-center py-8"
                >
                  {translate("ra.page.loading")}
                </TableCell>
              </TableRow>
            ) : !data?.length ? (
              <TableRow>
                <TableCell
                  colSpan={orderedColumns.length + (bulkActions ? 2 : 1)}
                  className="text-center py-8"
                >
                  {translate("ra.navigation.no_results")}
                </TableCell>
              </TableRow>
            ) : (
              data.map((record) => (
                <RecordContextProvider key={record.id} value={record}>
                  <TableRow
                    className={cn(
                      isDeleted(record) && "opacity-50 bg-red-50/50 dark:bg-red-950/20"
                    )}
                  >
                    {bulkActions && (
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(record.id)}
                          onCheckedChange={() => toggleSelect(record.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                    )}
                    {orderedColumns.map((col) =>
                      col.editable && !isDeleted(record) ? (
                        <EditableCell
                          key={col.source}
                          source={col.source}
                          resource={resource}
                          type={col.type}
                          options={col.options}
                          referenceData={getReferenceData(col)}
                          renderDisplay={
                            col.render
                              ? (_, r) => col.render!(r as RecordType)
                              : col.renderLink && col.linkPath
                              ? (val, r) => (
                                  <Link
                                    to={col.linkPath!(r as RecordType)}
                                    className="text-primary hover:underline flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {val}
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                )
                              : undefined
                          }
                        />
                      ) : (
                        <TableCell key={col.source} className="py-1">
                          {col.render ? (
                            col.render(record)
                          ) : col.renderLink && col.linkPath ? (
                            <Link
                              to={col.linkPath(record)}
                              className="text-primary hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {getNestedValue(record, col.source)}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            getNestedValue(record, col.source) ?? "-"
                          )}
                        </TableCell>
                      )
                    )}
                    <TableCell>
                      {isDeleted(record) ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(record);
                          }}
                          title={translate("crm.soft_delete.restore", { _: "Wiederherstellen" })}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRecordToDelete(record);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                </RecordContextProvider>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Total count */}
      {total !== undefined && (
        <div className="text-sm text-muted-foreground mt-2">
          {total} {translate("ra.navigation.page_rows_per_page", { _: "Einträge" })}
          {state.showDeleted && deletedCount && deletedCount > 0 && (
            <span className="text-red-500 ml-2">
              ({deletedCount} gelöscht)
            </span>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {translate("ra.message.delete_title", {
                name: resource,
                smart_count: recordToDelete ? 1 : selectedIds.length,
              })}
            </DialogTitle>
            <DialogDescription>
              {enableSoftDelete ? (
                translate("crm.soft_delete.confirm_message", {
                  _: "Der Eintrag wird in den Papierkorb verschoben und kann wiederhergestellt werden.",
                })
              ) : (
                translate("ra.message.delete_content", {
                  name: resource,
                  smart_count: recordToDelete ? 1 : selectedIds.length,
                })
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {translate("ra.action.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                recordToDelete
                  ? handleDelete(recordToDelete)
                  : handleBulkDelete()
              }
            >
              {translate("ra.action.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

export default EditableDataGrid;
