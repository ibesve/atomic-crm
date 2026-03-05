/**
 * ra-search: Global search wrapper using Shadcn Command component.
 *
 * Uses the useSearchController hook from ra-search to provide
 * a global search dialog triggered by Ctrl+K / Cmd+K.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useTranslate, useCreatePath, useResourceDefinitions } from "ra-core";
import { useSearchController } from "@react-admin/ra-search";
import { Search, Loader2 } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface GlobalSearchProps {
  /** Resources to include in search results */
  resources?: string[];
}

export function GlobalSearch(_props: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const translate = useTranslate();
  const navigate = useNavigate();
  const createPath = useCreatePath();
  const resourceDefs = useResourceDefinitions();
  const inputRef = useRef<HTMLInputElement>(null);

  const { query: searchQuery, doSearch, searchData } = useSearchController({});

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = useCallback(
    (resource: string, id: string | number) => {
      const path = createPath({ resource, type: "show", id });
      navigate(path);
      setOpen(false);
      doSearch("");
    },
    [createPath, navigate, doSearch],
  );

  const results = searchData?.data ?? [];
  const isPending = searchData?.isLoading ?? false;

  // Group results by resource
  const grouped = results.reduce<
    Record<string, Array<{ id: string | number; content: any }>>
  >((acc, item: any) => {
    const resource = item.content?.type ?? "unknown";
    if (!acc[resource]) acc[resource] = [];
    acc[resource].push(item);
    return acc;
  }, {});

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-9 p-0 xl:h-9 xl:w-60 xl:justify-start xl:px-3 xl:py-2"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 xl:mr-2" />
        <span className="hidden xl:inline-flex">
          {translate("ra-search.action", { _: "Suchen..." })}
        </span>
        <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 xl:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          ref={inputRef}
          placeholder={translate("ra-search.placeholder", {
            _: "Kontakte, Unternehmen, Deals durchsuchen…",
          })}
          value={searchQuery}
          onValueChange={doSearch}
        />
        <CommandList>
          {isPending && searchQuery.length > 0 ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : searchQuery.length === 0 ? (
            <CommandEmpty>
              {translate("ra-search.tip", {
                _: "Tippen Sie, um zu suchen",
              })}
            </CommandEmpty>
          ) : Object.keys(grouped).length === 0 ? (
            <CommandEmpty>
              {translate("ra-search.nothing_found", {
                _: "Keine Ergebnisse gefunden",
              })}
            </CommandEmpty>
          ) : (
            Object.entries(grouped).map(([resource, items], idx) => (
              <div key={resource}>
                {idx > 0 && <CommandSeparator />}
                <CommandGroup
                  heading={
                    resourceDefs[resource]
                      ? translate(`resources.${resource}.name`, {
                          smart_count: 2,
                          _: resource,
                        })
                      : resource
                  }
                >
                  {items.map((item) => (
                    <CommandItem
                      key={`${resource}-${item.id}`}
                      onSelect={() => handleSelect(resource, item.id)}
                      className="cursor-pointer"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">
                          {item.content?.label ?? `#${item.id}`}
                        </span>
                        {item.content?.description && (
                          <span className="text-xs text-muted-foreground">
                            {item.content.description}
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {resource}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            ))
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

export default GlobalSearch;
