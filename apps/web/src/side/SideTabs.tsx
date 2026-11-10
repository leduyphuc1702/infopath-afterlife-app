// Spec 09 design §5: the side panel's "Fields" | "Data connections" tabs (ARIA tabs, automatic
// activation: Left and Right move and select, Home and End go to the ends).
import type { KeyboardEvent, ReactNode } from 'react';

export type SideTab = 'fields' | 'connections';

const TABS: readonly { readonly id: SideTab; readonly label: string }[] = [
  { id: 'fields', label: 'Fields' },
  { id: 'connections', label: 'Data connections' },
];

interface Props {
  readonly tab: SideTab;
  readonly onTab: (tab: SideTab) => void;
  readonly panels: Readonly<Record<SideTab, ReactNode>>;
}

export function SideTabs({ tab, onTab, panels }: Props) {
  const onKey = (e: KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const next =
      e.key === 'ArrowRight'
        ? TABS[(i + 1) % TABS.length]
        : e.key === 'ArrowLeft'
          ? TABS[(i + TABS.length - 1) % TABS.length]
          : e.key === 'Home'
            ? TABS[0]
            : e.key === 'End'
              ? TABS.at(-1)
              : undefined;
    if (!next) return;
    e.preventDefault();
    onTab(next.id);
    document.getElementById(`afl-tab-${next.id}`)?.focus();
  };
  return (
    <section className="afl-panel">
      <div className="afl-tabs" role="tablist" aria-label="About this form" onKeyDown={onKey}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`afl-tab-${t.id}`}
            className="afl-tab"
            aria-selected={t.id === tab}
            aria-controls={`afl-tabpanel-${t.id}`}
            tabIndex={t.id === tab ? 0 : -1}
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {TABS.map((t) => (
        // Both stay mounted, so the tree keeps its open groups while the other tab shows.
        <div
          key={t.id}
          role="tabpanel"
          id={`afl-tabpanel-${t.id}`}
          aria-labelledby={`afl-tab-${t.id}`}
          hidden={t.id !== tab}
        >
          {panels[t.id]}
        </div>
      ))}
    </section>
  );
}
