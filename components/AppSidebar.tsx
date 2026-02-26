"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getMe, listConversations, clearTokens, type UserMe } from "@/lib/api";
import {
  MessageCircle,
  BarChart3,
  Megaphone,
  Users,
  Settings,
  Search,
  ChevronDown,
  Send,
  MessageSquarePlus,
  Mic,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Image from "next/image";
import { useSidebar } from "@/hooks/use-sidebar";

interface SubItem {
  title: string;
  url: string;
  icon: typeof Send;
}

interface MenuItem {
  title: string;
  url: string;
  icon: typeof MessageCircle;
  count?: number;
  expandable?: boolean;
  subItems?: SubItem[];
}

const menuItemsDef: Omit<MenuItem, "count">[] = [
  { title: "Conversas", url: "/conversas", icon: MessageCircle },
  { title: "CRM", url: "/crm", icon: BarChart3 },
  {
    title: "Disparos", url: "/disparos", icon: Megaphone, expandable: true,
    subItems: [
      { title: "Disparo de Mensagens", url: "/disparos", icon: Send },
      { title: "Recepção Automática", url: "/disparos/recepcao", icon: MessageSquarePlus },
      { title: "Áudio Programado", url: "/disparos/audio", icon: Mic },
      { title: "Agendamento", url: "/disparos/agendamento", icon: Clock },
    ],
  },
  { title: "Contatos", url: "/contatos", icon: Users },
];


export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggle } = useSidebar();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const [user, setUser] = useState<UserMe | null>(null);
  const [convCount, setConvCount] = useState(0);

  useEffect(() => {
    getMe().then(setUser).catch(() => {});
    listConversations({ status: "atendendo" })
      .then((list) => setConvCount(list.length))
      .catch(() => {});
  }, []);

  const menuItems: MenuItem[] = menuItemsDef.map((m) =>
    m.title === "Conversas" ? { ...m, count: convCount || undefined } : m
  );

  const filteredItems = menuItems.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleExpand = (title: string) => {
    setExpandedMenus((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const handleLogout = () => {
    clearTokens();
    toast.success("Logout realizado");
    router.replace("/login");
  };

  const userName = user?.name || "Usuário";
  const userInitial = userName.charAt(0).toUpperCase();
  const userPlan = user?.plan || "basic";

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen flex flex-col bg-[var(--sidebar-background)] border-r border-[var(--sidebar-border)] transition-all duration-300 ease-in-out",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Logo + Toggle */}
      <div className={cn("flex items-center pt-6 pb-4", collapsed ? "justify-center px-2" : "gap-3 px-5")}>
        <Image src="/logo.png" alt="ZapProBR" width={36} height={36} className="rounded-xl object-contain flex-shrink-0" />
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <span className="text-base font-bold text-[var(--sidebar-accent-foreground)] tracking-tight block leading-tight">ZapProBR</span>
            <span className="text-xs text-[var(--sidebar-foreground)]">WhatsApp Manager</span>
          </div>
        )}
      </div>

      {/* Toggle button */}
      <div className={cn("px-3 pb-2", collapsed && "flex justify-center")}>
        <button
          onClick={toggle}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          className="p-2 rounded-lg hover:bg-[var(--sidebar-accent)] text-[var(--sidebar-foreground)] transition-colors"
        >
          {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
      </div>

      {/* Search (hidden when collapsed) */}
      {!collapsed && (
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--sidebar-foreground)]/60" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--sidebar-accent)] border border-[var(--sidebar-border)] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[var(--sidebar-accent-foreground)] placeholder:text-[var(--sidebar-foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--sidebar-ring)]/20 focus:border-[var(--sidebar-ring)]/30 transition-all"
            />
          </div>
        </div>
      )}

      {/* Nav Items */}
      <nav className={cn("flex-1 overflow-y-auto py-3 space-y-0.5", collapsed ? "px-2" : "px-3")}>
        {filteredItems.map((item) => {
          const isActive = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
          const isExpanded = expandedMenus[item.title];
          const hasSubItems = item.subItems && item.subItems.length > 0;

          return (
            <div key={item.title}>
              <div className="flex items-center">
                <Link
                  href={item.url}
                  title={collapsed ? item.title : undefined}
                  className={cn(
                    "flex-1 flex items-center rounded-xl text-sm font-medium transition-all duration-200",
                    collapsed ? "justify-center p-2.5" : "gap-3 px-3.5 py-2.5",
                    "text-[var(--sidebar-foreground)] hover:text-[var(--sidebar-accent-foreground)] hover:bg-[var(--sidebar-accent)]",
                    isActive && "bg-[var(--sidebar-primary)]/15 text-[var(--sidebar-primary)] !font-semibold"
                  )}
                >
                  <item.icon className={cn("w-[22px] h-[22px] flex-shrink-0 stroke-[1.8]", isActive && "text-[var(--sidebar-primary)]")} />
                  {!collapsed && <span className="flex-1">{item.title}</span>}
                  {!collapsed && item.count && (
                    <span className={cn(
                      "text-xs min-w-[22px] h-[22px] flex items-center justify-center rounded-md font-semibold",
                      isActive
                        ? "bg-[var(--sidebar-primary)]/20 text-[var(--sidebar-primary)]"
                        : "bg-[var(--sidebar-muted)] text-[var(--sidebar-foreground)]"
                    )}>
                      {item.count}
                    </span>
                  )}
                </Link>
                {!collapsed && hasSubItems && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      toggleExpand(item.title);
                    }}
                    className="p-2 rounded-lg hover:bg-[var(--sidebar-accent)] transition-colors"
                  >
                    <ChevronDown className={cn(
                      "w-4 h-4 text-[var(--sidebar-foreground)]/50 transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )} />
                  </button>
                )}
              </div>

              {/* Sub Items */}
              {!collapsed && hasSubItems && isExpanded && (
                <div className="ml-8 mt-1 space-y-0.5 border-l-2 border-[var(--sidebar-border)] pl-3">
                  {item.subItems!.map((sub) => {
                    const isSubActive = pathname === sub.url;
                    return (
                      <Link
                        key={sub.title}
                        href={sub.url}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200",
                          "text-[var(--sidebar-foreground)] hover:text-[var(--sidebar-accent-foreground)] hover:bg-[var(--sidebar-accent)]",
                          isSubActive && "text-[var(--sidebar-primary)] !font-semibold"
                        )}
                      >
                        <sub.icon className={cn("w-4 h-4 flex-shrink-0 stroke-[1.8]", isSubActive && "text-[var(--sidebar-primary)]")} />
                        <span>{sub.title}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={cn("border-t border-[var(--sidebar-border)] py-4 space-y-3", collapsed ? "px-2" : "px-4")}>
        <Link
          href="/configuracoes"
          title={collapsed ? "Configurações" : undefined}
          className={cn(
            "flex items-center rounded-xl text-sm font-medium text-[var(--sidebar-foreground)] hover:text-[var(--sidebar-accent-foreground)] hover:bg-[var(--sidebar-accent)] transition-all",
            collapsed ? "justify-center p-2.5" : "gap-3 px-3.5 py-2.5",
            pathname === "/configuracoes" && "bg-[var(--sidebar-primary)]/15 text-[var(--sidebar-primary)] !font-semibold"
          )}
        >
          <Settings className="w-[22px] h-[22px] stroke-[1.8]" />
          {!collapsed && <span>Configurações</span>}
        </Link>

        {!collapsed ? (
          <div className="flex items-center gap-3 px-3.5">
            <div className="w-8 h-8 rounded-full bg-[var(--sidebar-muted)] flex items-center justify-center text-xs font-semibold text-[var(--sidebar-foreground)]">
              {userInitial}
            </div>
            <span className="text-sm font-medium text-[var(--sidebar-accent-foreground)] flex-1 truncate">{userName}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-[var(--sidebar-primary)]/15 text-[var(--sidebar-primary)]">
              {userPlan}
            </span>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-[var(--sidebar-muted)] flex items-center justify-center text-xs font-semibold text-[var(--sidebar-foreground)]" title={userName}>
              {userInitial}
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          title={collapsed ? "Sair" : undefined}
          className={cn(
            "w-full flex items-center gap-2 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all",
            collapsed ? "justify-center p-2.5" : "justify-center px-3.5 py-2"
          )}
        >
          <LogOut className="w-[18px] h-[18px]" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
