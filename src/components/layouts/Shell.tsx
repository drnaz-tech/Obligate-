import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  BookOpen,
  CreditCard,
  Folder,
  Gauge,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  Swords,
  User,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { getMyNotifications, markNotificationsRead } from '@/lib/api';
import type { NotificationItem } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Stamp } from '@/components/dossier/Dossier';
import { SoundToggle } from '@/components/SoundToggle';
import { initAudio, stopAmbient } from '@/lib/sfx';

const NAV = [
  { to: '/app', label: 'Desk', icon: Gauge, end: true },
  { to: '/app/lobby', label: 'Rooms', icon: Swords },
  { to: '/app/campaigns', label: 'Campaigns', icon: BookOpen },
  { to: '/app/leaderboard', label: 'Leaderboard', icon: Folder },
  { to: '/app/groups', label: 'Groups', icon: Users },
  { to: '/app/profile', label: 'Profile', icon: User },
  { to: '/app/billing', label: 'Plan', icon: CreditCard },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

function Wordmark() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5">
      <span className="font-display text-lg font-semibold uppercase tracking-[0.26em] text-foreground md:text-xl">
        Obligate
      </span>
      <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
      <span className="hidden font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground sm:inline">
        case file
      </span>
    </Link>
  );
}

function NavList({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { profile } = useAuth();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex min-h-12 items-center gap-3 border-l-2 px-3 font-mono text-[12px] uppercase tracking-[0.1em] transition-colors md:min-h-9',
              collapsed && 'justify-center px-0',
              isActive
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground',
            )
          }
          title={collapsed ? item.label : undefined}
        >
          <item.icon className="h-4 w-4 shrink-0" aria-hidden />
          <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
        </NavLink>
      ))}
      {profile?.is_admin && (
        <NavLink
          to="/app/admin"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex min-h-12 items-center gap-3 border-l-2 px-3 font-mono text-[12px] uppercase tracking-[0.1em] transition-colors md:min-h-9',
              collapsed && 'justify-center px-0',
              isActive
                ? 'border-destructive bg-destructive/10 text-destructive'
                : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground',
            )
          }
          title={collapsed ? 'Admin' : undefined}
        >
          <Shield className="h-4 w-4 shrink-0" aria-hidden />
          <span className={cn('truncate', collapsed && 'sr-only')}>Admin</span>
        </NavLink>
      )}
    </nav>
  );
}

function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const unread = items.filter((n) => !n.read_at).length;

  useEffect(() => {
    let alive = true;
    const load = () =>
      getMyNotifications()
        .then((rows) => alive && setItems(rows))
        .catch(() => undefined);
    void load();
    const id = window.setInterval(load, 30000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && unread > 0) {
          void markNotificationsRead().then(() =>
            setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))),
          );
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
          Dispatches
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            Nothing on the wire. Invites and case drops land here.
          </p>
        ) : (
          items.slice(0, 8).map((n) => (
            <DropdownMenuItem key={n.id} asChild>
              <Link to={n.link || '/app'} className="flex flex-col items-start gap-0.5 py-2">
                <span className="text-sm font-medium">{n.title}</span>
                {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('obligate.sidebar');
    if (saved === '1') return true;
    if (saved === '0') return false;
    return /^\/app\/(room|lobby)/.test(window.location.pathname);
  });
  const [pinned, setPinned] = useState(() => localStorage.getItem('obligate.sidebar') !== null);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    initAudio();
    return () => stopAmbient();
  }, []);

  useEffect(() => {
    if (/^\/app\/room\//.test(location.pathname)) {
      setCollapsed(true);
      return;
    }
    const saved = localStorage.getItem('obligate.sidebar');
    if (saved === '1') setCollapsed(true);
    else if (saved === '0') setCollapsed(false);
  }, [location.pathname]);

  const toggleSidebar = () => {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem('obligate.sidebar', next ? '1' : '0');
      return next;
    });
    setPinned(true);
  };

  const isRoom = /^\/app\/room\//.test(location.pathname);

  return (
    <div className="flex min-h-screen w-full">
      <aside
        className={cn(
          'hidden shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar transition-[width] duration-200 ease-out md:flex',
          collapsed ? 'w-16' : 'w-56',
        )}
      >
        <div
          className={cn(
            'flex items-center border-b border-border',
            collapsed ? 'justify-center px-2 py-4' : 'justify-between gap-2 px-4 py-4',
          )}
        >
          {!collapsed && <Wordmark />}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg border border-border bg-muted/50 text-foreground hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
            title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          <NavList collapsed={collapsed} />
        </div>
        <div className={cn('border-t border-border', collapsed ? 'px-2 py-3' : 'px-4 py-3')}>
          {!collapsed && (
            <p className="truncate font-mono text-[13px] uppercase tracking-widest text-muted-foreground">
              {profile?.detective_name || 'Detective'}
            </p>
          )}
          <button
            type="button"
            onClick={() => void signOut().then(() => navigate('/'))}
            className={cn(
              'flex items-center gap-2 font-mono text-[12px] uppercase tracking-widest text-muted-foreground hover:text-foreground',
              collapsed ? 'justify-center' : 'mt-2',
            )}
            title="Sign out"
          >
            <LogOut className="h-3 w-3" /> {!collapsed && 'Sign out'}
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 mx-3 mt-3 flex h-14 items-center gap-3 rounded-full border border-white/10 bg-background/70 px-3 shadow-[0_0_50px_-18px_hsl(var(--primary)/0.4)] backdrop-blur-xl md:mx-4 md:mt-4 md:h-16 md:px-5">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="border-b border-border px-4 py-4">
                <Wordmark />
              </div>
              <div className="py-3">
                <NavList onNavigate={() => setMobileOpen(false)} />
              </div>
              <div className="border-t border-border px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    void signOut().then(() => navigate('/'));
                  }}
                  className="flex min-h-12 items-center gap-2 font-mono text-[12px] uppercase tracking-widest text-muted-foreground"
                >
                  <LogOut className="h-3 w-3" /> Sign out
                </button>
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1 md:hidden">
            <Wordmark />
          </div>
          <div className="hidden min-w-0 flex-1 md:block">
            <Stamp className="text-muted-foreground">Bureau open</Stamp>
          </div>
          <SoundToggle />
          <NotificationBell />
        </header>

        <main
          className={cn(
            'page-glow min-w-0 flex-1 overflow-x-hidden',
            isRoom ? 'px-3 py-4 md:px-6 md:py-6' : 'px-4 py-6 md:px-8 md:py-8',
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PublicLayout() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const links = [
    { to: '/how-it-works', label: 'How it works' },
    { to: '/pricing', label: 'Plans' },
    { to: '/cases', label: 'Case files' },
    { to: '/contact', label: 'Contact' },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-40 px-3 pt-3 md:px-6 md:pt-4">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 rounded-full border border-white/10 bg-background/70 px-3 shadow-[0_0_50px_-16px_hsl(var(--primary)/0.45)] backdrop-blur-xl md:h-16 md:gap-5 md:px-5">
          <Wordmark />
          <nav className="ml-auto hidden items-center gap-6 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    'font-mono text-[13px] uppercase tracking-[0.11em] transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {session ? (
              <Button asChild size="sm" className="font-mono text-[13px] uppercase tracking-widest">
                <Link to="/app">Enter the bureau</Link>
              </Button>
            ) : (
              <>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="hidden font-mono text-[13px] uppercase tracking-widest sm:inline-flex"
                >
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="rounded-full font-mono text-[12px] uppercase tracking-[0.11em] shadow-[0_0_26px_-6px_hsl(var(--primary)/0.8)]"
                >
                  <Link to="/auth?mode=signup">
                    Open a file <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                  </Link>
                </Button>
              </>
            )}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" aria-label="Menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 bg-sidebar">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <div className="mt-8 flex flex-col">
                  {links.map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      onClick={() => setOpen(false)}
                      className="flex min-h-12 items-center border-b border-border font-mono text-xs uppercase tracking-[0.11em] text-muted-foreground"
                    >
                      {l.label}
                    </Link>
                  ))}
                  <Link
                    to="/auth"
                    onClick={() => setOpen(false)}
                    className="flex min-h-12 items-center font-mono text-xs uppercase tracking-[0.11em] text-primary"
                  >
                    Sign in
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="page-glow flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.28em]">Obligate</p>
            <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.11em] text-muted-foreground">
              Two players. Different clues. One truth.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[12px] uppercase tracking-[0.11em] text-muted-foreground">
            <Link to="/how-it-works" className="hover:text-foreground">How it works</Link>
            <Link to="/pricing" className="hover:text-foreground">Plans</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/contact" className="hover:text-foreground">Contact</Link>
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 pb-8 md:px-6">
          <div className="flex flex-col gap-2 border-t border-white/5 pt-5 font-mono text-[11px] uppercase tracking-[0.11em] text-muted-foreground md:flex-row md:items-center md:justify-between">
            <p className="text-pretty">
              Chat powered by <span className="text-foreground">Nexconn Chat SDK</span>
            </p>
            <p className="text-pretty">
              Built for the <span className="text-foreground">NexCon Challenge</span>
            </p>
            <p className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              Currently in beta
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
