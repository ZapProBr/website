"use client";

import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
  fullHeight?: boolean;
}

function LayoutInner({ children, fullHeight }: AppLayoutProps) {
  const { collapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className={cn(
        "transition-all duration-300 ease-in-out",
        collapsed ? "ml-[72px]" : "ml-[260px]",
        fullHeight ? "h-screen p-0" : "p-6 lg:p-8"
      )}>
        {children}
      </main>
    </div>
  );
}

export function AppLayout({ children, fullHeight }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <LayoutInner fullHeight={fullHeight}>{children}</LayoutInner>
    </SidebarProvider>
  );
}
