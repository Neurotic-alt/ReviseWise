import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bot,
  CalendarDays,
  Cloud,
  CloudOff,
  LayoutDashboard,
  ListChecks,
  LogIn,
  LogOut,
  Settings,
} from "lucide-react";
import { signOutStudent, useSyncStatus } from "@/lib/data/cloud-sync";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "./Logo";

export const NAV_ITEMS = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "AI Companion", url: "/companion", icon: Bot },
  { title: "Quiz Studio", url: "/quiz", icon: ListChecks },
  { title: "Revision Planner", url: "/planner", icon: CalendarDays },
  { title: "My Progress", url: "/progress", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <Logo compact={collapsed} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className="h-10 rounded-lg text-sidebar-foreground/80 transition-colors data-[active=true]:bg-primary/15 data-[active=true]:text-foreground data-[active=true]:[&_svg]:text-primary-glow"
                    >
                      <Link to={item.url} onClick={() => setOpenMobile(false)}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <AccountBox collapsed={collapsed} onNavigate={() => setOpenMobile(false)} />
      </SidebarFooter>
    </Sidebar>
  );
}

const STATE_TEXT = {
  loading: "Loading your saved data…",
  saving: "Saving…",
  saved: "Saved to your account",
  error: "Couldn't save — will retry on your next change",
} as const;

function AccountBox({ collapsed, onNavigate }: { collapsed: boolean; onNavigate: () => void }) {
  const sync = useSyncStatus();
  if (sync.state === "guest") {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="Sign in to save" className="h-10 rounded-lg">
            <Link to="/auth" onClick={onNavigate}>
              <LogIn />
              <span>Sign in to save your progress</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }
  const Icon = sync.state === "error" ? CloudOff : Cloud;
  return (
    <SidebarMenu>
      {!collapsed && (
        <li className="list-none px-2 pb-1 text-xs text-muted-foreground">
          <p className="truncate font-medium text-foreground">{sync.email ?? "Signed in"}</p>
          <p className="mt-0.5 flex items-center gap-1.5">
            <Icon className={sync.state === "error" ? "size-3.5 text-warning" : "size-3.5 text-success"} />
            {STATE_TEXT[sync.state]}
          </p>
        </li>
      )}
      <SidebarMenuItem>
        <SidebarMenuButton tooltip="Sign out" className="h-10 rounded-lg" onClick={() => void signOutStudent()}>
          <LogOut />
          <span>Sign out</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
