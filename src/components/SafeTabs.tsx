import { useMemo, useState, type ReactNode } from "react";

export type SafeTabItem = {
  id: string;
  label: string;
  badge?: string | number;
  content: ReactNode;
};

export function SafeTabs({
  title,
  subtitle,
  tabs,
}: {
  title: string;
  subtitle?: string;
  tabs: SafeTabItem[];
}) {
  const firstTabId = tabs[0]?.id ?? "";
  const [activeTabId, setActiveTabId] = useState(firstTabId);

  const activeTab = useMemo(() => {
    return tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null;
  }, [tabs, activeTabId]);

  if (!activeTab) {
    return (
      <section className="panel">
        <p className="empty-state">No hay contenido disponible.</p>
      </section>
    );
  }

  return (
    <section className="safe-tabs">
      <div className="safe-tabs__header">
        <div>
          <p className="eyebrow">Vista organizada</p>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>

        <div className="safe-tabs__buttons" role="tablist">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={tab.id === activeTab.id ? "active" : ""}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && <strong>{tab.badge}</strong>}
            </button>
          ))}
        </div>
      </div>

      <div className="safe-tabs__body">{activeTab.content}</div>
    </section>
  );
}