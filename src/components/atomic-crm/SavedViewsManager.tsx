/**
 * SavedViewsManager — CRUD for saved views stored in the saved_views table.
 *
 * Features:
 * - Load/Save/Delete views
 * - Share views with other users
 * - Set a default view per resource
 * - Persists filters, sort, and visible columns
 */
import { useState, useCallback, useMemo } from "react";
import {
  useGetList,
  useCreate,
  useUpdate,
  useDelete,
  useGetIdentity,
  useNotify,
  useRefresh,
} from "ra-core";
import {
  Save,
  Bookmark,
  Trash2,
  Share2,
  Star,
  Pencil,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type {
  SavedView,
  SavedViewFilters,
  SavedViewSort,
  SavedViewColumn,
} from "./types/custom-objects";

// ── Hook: useSavedViews ─────────────────────────────────────

interface UseSavedViewsReturn {
  views: SavedView[];
  isLoading: boolean;
  activeView: SavedView | null;
  loadView: (view: SavedView) => void;
  saveView: (data: SavedViewSaveData) => Promise<void>;
  updateView: (id: number, data: Partial<SavedViewSaveData>) => Promise<void>;
  deleteView: (id: number) => Promise<void>;
  setDefault: (id: number) => Promise<void>;
  clearActiveView: () => void;
}

interface SavedViewSaveData {
  name: string;
  description?: string;
  filters: SavedViewFilters;
  sort: SavedViewSort | null;
  columns: SavedViewColumn[] | null;
  is_shared: boolean;
}

export function useSavedViews(resource: string): UseSavedViewsReturn {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();
  const [create] = useCreate();
  const [update] = useUpdate();
  const [deleteOne] = useDelete();
  const [activeViewId, setActiveViewId] = useState<number | null>(null);

  const { data: views, isLoading } = useGetList<SavedView>("saved_views", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "name", order: "ASC" },
    filter: { resource, "deleted_at@is": "null" },
  });

  const viewList = views || [];
  const activeView = useMemo(
    () => viewList.find((v) => v.id === activeViewId) || null,
    [viewList, activeViewId],
  );

  const loadView = useCallback((view: SavedView) => {
    setActiveViewId(view.id);
  }, []);

  const clearActiveView = useCallback(() => {
    setActiveViewId(null);
  }, []);

  const saveView = useCallback(
    async (data: SavedViewSaveData) => {
      try {
        await create(
          "saved_views",
          {
            data: {
              ...data,
              resource,
              created_by: identity?.id || null,
              is_default: false,
            },
          },
          { returnPromise: true },
        );
        notify("Ansicht gespeichert", { type: "success" });
        refresh();
      } catch (error) {
        notify(
          error instanceof Error ? error.message : "Fehler beim Speichern",
          { type: "error" },
        );
      }
    },
    [create, resource, identity, notify, refresh],
  );

  const updateView = useCallback(
    async (id: number, data: Partial<SavedViewSaveData>) => {
      try {
        const existing = viewList.find((v) => v.id === id);
        await update(
          "saved_views",
          { id, data, previousData: existing },
          { returnPromise: true },
        );
        notify("Ansicht aktualisiert", { type: "success" });
        refresh();
      } catch (error) {
        notify(
          error instanceof Error ? error.message : "Fehler beim Aktualisieren",
          { type: "error" },
        );
      }
    },
    [update, viewList, notify, refresh],
  );

  const deleteView = useCallback(
    async (id: number) => {
      try {
        const existing = viewList.find((v) => v.id === id);
        await deleteOne(
          "saved_views",
          { id, previousData: existing },
          { returnPromise: true },
        );
        if (activeViewId === id) setActiveViewId(null);
        notify("Ansicht gelöscht", { type: "success" });
        refresh();
      } catch (error) {
        notify(
          error instanceof Error ? error.message : "Fehler beim Löschen",
          { type: "error" },
        );
      }
    },
    [deleteOne, viewList, activeViewId, notify, refresh],
  );

  const setDefault = useCallback(
    async (id: number) => {
      // Unset other defaults for this resource
      for (const v of viewList) {
        if (v.is_default && v.id !== id) {
          await update(
            "saved_views",
            { id: v.id, data: { is_default: false }, previousData: v },
            { returnPromise: true },
          ).catch(() => {});
        }
      }
      const existing = viewList.find((v) => v.id === id);
      await update(
        "saved_views",
        { id, data: { is_default: true }, previousData: existing },
        { returnPromise: true },
      );
      notify("Standardansicht gesetzt", { type: "success" });
      refresh();
    },
    [update, viewList, notify, refresh],
  );

  return {
    views: viewList,
    isLoading,
    activeView,
    loadView,
    saveView,
    updateView,
    deleteView,
    setDefault,
    clearActiveView,
  };
}

// ── SavedViewsManager Component ─────────────────────────────

interface SavedViewsManagerProps {
  resource: string;
  /** Current filter state to save */
  currentFilters: SavedViewFilters;
  /** Current sort to save */
  currentSort: SavedViewSort | null;
  /** Current visible columns to save */
  currentColumns: SavedViewColumn[] | null;
  /** Called when a view is loaded */
  onLoadView: (view: SavedView) => void;
  /** Called when the active view is cleared (back to defaults) */
  onClearView: () => void;
}

export const SavedViewsManager = ({
  resource,
  currentFilters,
  currentSort,
  currentColumns,
  onLoadView,
  onClearView,
}: SavedViewsManagerProps) => {
  const {
    views,
    isLoading,
    activeView,
    loadView,
    saveView,
    updateView,
    deleteView,
    setDefault,
    clearActiveView,
  } = useSavedViews(resource);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editDialogView, setEditDialogView] = useState<SavedView | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saveShared, setSaveShared] = useState(false);

  const handleLoad = useCallback(
    (view: SavedView) => {
      loadView(view);
      onLoadView(view);
    },
    [loadView, onLoadView],
  );

  const handleClear = useCallback(() => {
    clearActiveView();
    onClearView();
  }, [clearActiveView, onClearView]);

  const handleSaveNew = useCallback(async () => {
    if (!saveName.trim()) return;
    await saveView({
      name: saveName.trim(),
      description: saveDescription.trim() || undefined,
      filters: currentFilters,
      sort: currentSort,
      columns: currentColumns,
      is_shared: saveShared,
    });
    setSaveDialogOpen(false);
    setSaveName("");
    setSaveDescription("");
    setSaveShared(false);
  }, [saveName, saveDescription, saveShared, currentFilters, currentSort, currentColumns, saveView]);

  const handleUpdateCurrent = useCallback(async () => {
    if (!activeView) return;
    await updateView(activeView.id, {
      filters: currentFilters,
      sort: currentSort,
      columns: currentColumns,
    });
  }, [activeView, currentFilters, currentSort, currentColumns, updateView]);

  const handleDelete = useCallback(async () => {
    if (deleteConfirmId === null) return;
    await deleteView(deleteConfirmId);
    setDeleteConfirmId(null);
  }, [deleteConfirmId, deleteView]);

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Bookmark className="h-3.5 w-3.5" />
            {activeView ? activeView.name : "Ansichten"}
            {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px]" align="start">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Gespeicherte Ansichten</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setSaveDialogOpen(true)}
              >
                <Save className="h-3 w-3" /> Neue speichern
              </Button>
            </div>

            {/* Active view indicator */}
            {activeView && (
              <div className="flex items-center justify-between bg-muted/50 rounded px-2 py-1">
                <span className="text-xs truncate">
                  Aktiv: <strong>{activeView.name}</strong>
                </span>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-1"
                    onClick={handleUpdateCurrent}
                    title="Aktuelle Filter überschreiben"
                  >
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-1"
                    onClick={handleClear}
                  >
                    Zurücksetzen
                  </Button>
                </div>
              </div>
            )}

            {/* View list */}
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {views.length === 0 && !isLoading && (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  Keine gespeicherten Ansichten
                </p>
              )}
              {views.map((view) => (
                <div
                  key={view.id}
                  className={`flex items-center justify-between rounded px-2 py-1.5 cursor-pointer hover:bg-muted/50 ${
                    activeView?.id === view.id ? "bg-muted" : ""
                  }`}
                  onClick={() => handleLoad(view)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {view.is_default && (
                      <Star className="h-3 w-3 text-yellow-500 shrink-0 fill-yellow-500" />
                    )}
                    <div className="min-w-0">
                      <span className="text-sm truncate block">{view.name}</span>
                      {view.description && (
                        <span className="text-xs text-muted-foreground truncate block">
                          {view.description}
                        </span>
                      )}
                    </div>
                    {view.is_shared && (
                      <Badge variant="outline" className="text-[10px] px-1 h-4 shrink-0">
                        <Share2 className="h-2.5 w-2.5 mr-0.5" /> Geteilt
                      </Badge>
                    )}
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[180px] p-1" align="end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-7 gap-2"
                        onClick={(e) => { e.stopPropagation(); setEditDialogView(view); }}
                      >
                        <Pencil className="h-3 w-3" /> Umbenennen
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-7 gap-2"
                        onClick={(e) => { e.stopPropagation(); setDefault(view.id); }}
                      >
                        <Star className="h-3 w-3" /> Als Standard
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-7 gap-2"
                        onClick={(e) => { e.stopPropagation(); updateView(view.id, { is_shared: !view.is_shared }); }}
                      >
                        <Share2 className="h-3 w-3" /> {view.is_shared ? "Privat machen" : "Teilen"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-7 gap-2 text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(view.id); }}
                      >
                        <Trash2 className="h-3 w-3" /> Löschen
                      </Button>
                    </PopoverContent>
                  </Popover>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Save New Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ansicht speichern</DialogTitle>
            <DialogDescription>
              Speichern Sie die aktuellen Filter, Sortierung und Spalten als wiederverwendbare Ansicht.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="view-name">Name</Label>
              <Input
                id="view-name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="z.B. Aktive Kunden Q1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="view-desc">Beschreibung (optional)</Label>
              <Input
                id="view-desc"
                value={saveDescription}
                onChange={(e) => setSaveDescription(e.target.value)}
                placeholder="Kurze Beschreibung…"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="view-shared"
                checked={saveShared}
                onCheckedChange={setSaveShared}
              />
              <Label htmlFor="view-shared" className="text-sm">
                Mit Team teilen
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveNew} disabled={!saveName.trim()}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Rename Dialog */}
      <Dialog open={!!editDialogView} onOpenChange={(open) => !open && setEditDialogView(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ansicht umbenennen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editDialogView?.name || ""}
                onChange={(e) =>
                  setEditDialogView((prev: SavedView | null) => prev ? { ...prev, name: e.target.value } : null)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Input
                value={editDialogView?.description || ""}
                onChange={(e) =>
                  setEditDialogView((prev: SavedView | null) => prev ? { ...prev, description: e.target.value } : null)
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditDialogView(null)}>
              Abbrechen
            </Button>
            <Button
              onClick={async () => {
                if (editDialogView) {
                  await updateView(editDialogView.id, {
                    name: editDialogView.name,
                    description: editDialogView.description || undefined,
                  });
                  setEditDialogView(null);
                }
              }}
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ansicht löschen?</DialogTitle>
            <DialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SavedViewsManager;
