import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDownIcon, SidebarIcon, ShieldIcon } from '@/components/icons';
import type { NavigationItem, OrganizationProfile } from '@/types/dashboard';

type HighlightStyle = {
  height: number;
  opacity: number;
  transform: string;
};

type SidebarProps = {
  activeId: string;
  navigation: NavigationItem[];
  organization: OrganizationProfile;
  onSelect: (id: string) => void;
};

export function Sidebar({
  activeId,
  navigation,
  organization,
  onSelect,
}: SidebarProps) {
  const [expandedIds, setExpandedIds] = useState<string[]>(['personil-keamanan']);
  const [selectedRootId, setSelectedRootId] = useState<string | null>(() => {
    const activeItem = navigation.find(
      (item) => item.id === activeId || item.children?.some((child) => child.id === activeId)
    );

    return activeItem?.id ?? navigation[0]?.id ?? null;
  });
  const [rootHighlight, setRootHighlight] = useState<HighlightStyle | null>(null);
  const [childHighlights, setChildHighlights] = useState<Record<string, HighlightStyle>>({});
  const navRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const subnavRefs = useRef(new Map<string, HTMLDivElement>());
  const childRefs = useRef(new Map<string, HTMLElement>());

  const activeRootId = useMemo(() => {
    const activeItem = navigation.find(
      (item) => item.id === activeId || item.children?.some((child) => child.id === activeId)
    );

    return activeItem?.id ?? null;
  }, [activeId, navigation]);

  useEffect(() => {
    if (activeRootId) {
      setSelectedRootId(activeRootId);
    }
  }, [activeRootId]);

  function toggleExpanded(id: string) {
    setExpandedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  const visibleRootId = selectedRootId ?? activeRootId;

  useLayoutEffect(() => {
    function updateHighlights() {
      const navNode = navRef.current;
      const nextRootNode = visibleRootId ? itemRefs.current.get(visibleRootId) : null;
      if (navNode && nextRootNode) {
        const navRect = navNode.getBoundingClientRect();
        const rootRect = nextRootNode.getBoundingClientRect();
        setRootHighlight({
          height: rootRect.height,
          opacity: 1,
          transform: `translateY(${rootRect.top - navRect.top + navNode.scrollTop}px)`,
        });
      } else {
        setRootHighlight(null);
      }

      const nextChildHighlights: Record<string, HighlightStyle> = {};
      navigation.forEach((item) => {
        const activeChild = item.children?.find((child) => child.id === activeId);
        const subnavNode = subnavRefs.current.get(item.id);
        const activeChildNode = activeChild ? childRefs.current.get(activeChild.id) : null;

        if (subnavNode && activeChildNode) {
          const subnavRect = subnavNode.getBoundingClientRect();
          const childRect = activeChildNode.getBoundingClientRect();
          const top = childRect.top - subnavRect.top + subnavNode.scrollTop;
          nextChildHighlights[item.id] = {
            height: childRect.height,
            opacity: 1,
            transform: `translateY(${top}px)`,
          };
        }
      });

      setChildHighlights(nextChildHighlights);
    }

    const frameId = window.requestAnimationFrame(updateHighlights);
    window.addEventListener('resize', updateHighlights);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updateHighlights);
    };
  }, [activeId, expandedIds, navigation, visibleRootId]);

  function registerItemRef(id: string, node: HTMLElement | null) {
    if (node) {
      itemRefs.current.set(id, node);
      return;
    }

    itemRefs.current.delete(id);
  }

  function registerSubnavRef(id: string, node: HTMLDivElement | null) {
    if (node) {
      subnavRefs.current.set(id, node);
      return;
    }

    subnavRefs.current.delete(id);
  }

  function registerChildRef(id: string, node: HTMLElement | null) {
    if (node) {
      childRefs.current.set(id, node);
      return;
    }

    childRefs.current.delete(id);
  }

  return (
    <aside className="sidebar">
      <div className="brand-card">
        <div className="brand-mark">
          <ShieldIcon className="brand-mark-icon" />
        </div>
        <div>
          <p className="eyebrow">Dashboard Keamanan</p>
          <h1 className="brand-title">{organization.branch}</h1>
        </div>
      </div>

      <div className="sidebar-group">
        <p className="sidebar-label">Menu Utama</p>
        <nav ref={navRef} className="sidebar-nav" aria-label="Menu utama keamanan">
          {rootHighlight ? <span className="sidebar-highlight" style={rootHighlight} aria-hidden="true" /> : null}
          {navigation.map((item) => {
            const isActive = visibleRootId === item.id;

            if (item.children?.length) {
              const isOpen = expandedIds.includes(item.id);

              return (
                <div key={item.id} className={`sidebar-tree ${isOpen ? 'is-open' : ''}`}>
                  <button
                    ref={(node) => registerItemRef(item.id, node)}
                    type="button"
                    className={`sidebar-link sidebar-link--tree ${isActive ? 'is-active' : ''}`}
                    onClick={() => {
                      setSelectedRootId(item.id);
                      onSelect(item.id);
                      toggleExpanded(item.id);
                    }}
                  >
                    <span className="sidebar-link-main">
                      <span className="sidebar-link-icon">
                        <SidebarIcon name={item.icon} className="mini-icon" />
                      </span>
                      <span>
                        <span className="sidebar-link-title">{item.label}</span>
                        {item.description ? (
                          <span className="sidebar-link-copy">{item.description}</span>
                        ) : null}
                      </span>
                      <span className="sidebar-chevron" aria-hidden="true">
                        <ChevronDownIcon className="mini-icon" />
                      </span>
                    </span>
                  </button>

                  {isOpen ? (
                    <div ref={(node) => registerSubnavRef(item.id, node)} className="sidebar-subnav">
                      {childHighlights[item.id] ? (
                        <span
                          className="sidebar-subnav-highlight"
                          style={childHighlights[item.id]}
                          aria-hidden="true"
                        />
                      ) : null}
                      {item.children.map((child) => (
                        <a
                          key={child.id}
                          ref={(node) => registerChildRef(child.id, node)}
                          href={child.href}
                          className={`sidebar-sublink ${activeId === child.id ? 'is-active' : ''}`}
                          onClick={(event) => {
                            event.preventDefault();
                            setSelectedRootId(item.id);
                            onSelect(child.id);
                          }}
                        >
                          <span className="sidebar-sublink-branch" aria-hidden="true" />
                          <span className="sidebar-sublink-icon">
                            <SidebarIcon name={child.icon} className="mini-icon" />
                          </span>
                          <span className="sidebar-link-title">{child.label}</span>
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <a
                key={item.id}
                ref={(node) => registerItemRef(item.id, node)}
                href={item.href}
                className={`sidebar-link ${isActive ? 'is-active' : ''}`}
                onClick={(event) => {
                  event.preventDefault();
                  setSelectedRootId(item.id);
                  onSelect(item.id);
                }}
              >
                <span className="sidebar-link-icon">
                  <SidebarIcon name={item.icon} className="mini-icon" />
                </span>
                <span>
                  <span className="sidebar-link-title">{item.label}</span>
                  {item.description ? <span className="sidebar-link-copy">{item.description}</span> : null}
                </span>
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
