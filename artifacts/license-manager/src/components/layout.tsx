import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { 
  Shield, LayoutDashboard, Key, Users, Activity, 
  LogOut, Menu, X, Box, Bell
} from "lucide-react";
import { useAuthWrapper } from "@/hooks/use-auth-wrapper";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
  title: string;
}

export function Layout({ children, title }: LayoutProps) {
  const { user, logout } = useAuthWrapper();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

  const navItems = isAdmin ? [
    { icon: Activity, label: "Overview", href: "/admin" },
    { icon: Key, label: "Master Licenses", href: "/admin?tab=licenses" },
    { icon: Users, label: "Users", href: "/admin?tab=users" },
    { icon: Bell, label: "Alerts", href: "/admin?tab=alerts" },
  ] : [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-card/50 backdrop-blur-xl z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-accent flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">KeyForge</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-muted-foreground hover:text-white transition-colors">
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed md:static inset-y-0 left-0 z-40 w-64 glass-card border-l-0 border-y-0 md:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center gap-3 border-b border-white/5 hidden md:flex">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-white">KeyForge</span>
        </div>

        <div className="p-4 flex-1 flex flex-col gap-2 overflow-y-auto pt-24 md:pt-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
            Menu
          </div>
          {navItems.map((item) => {
            const isActive = location === item.href || (location.startsWith('/apps') && item.href === '/dashboard');
            return (
              <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)} className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200 group relative overflow-hidden",
                isActive ? "text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"
              )}>
                {isActive && (
                  <motion.div 
                    layoutId="activeNav" 
                    className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-xl -z-10" 
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "group-hover:text-primary transition-colors")} />
                {item.label}
              </Link>
            )
          })}
        </div>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/5 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-secondary to-muted border border-white/10 flex items-center justify-center shrink-0">
              <span className="font-bold text-sm text-white">{user?.username?.charAt(0).toUpperCase() || 'U'}</span>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.role === 'admin' ? 'Super Admin' : 'Reseller'}</p>
            </div>
          </div>
          <button 
            onClick={() => logout()} 
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 max-h-screen overflow-y-auto">
        <header className="px-6 md:px-10 py-6 border-b border-white/5 sticky top-0 bg-background/80 backdrop-blur-xl z-30 hidden md:flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-white">{title}</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your licenses and applications securely.</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Can add search or notifications here */}
          </div>
        </header>

        <div className="p-4 md:p-10 flex-1 animate-in-slide">
          <div className="md:hidden mb-6">
            <h1 className="text-2xl font-display font-bold text-white">{title}</h1>
          </div>
          {children}
        </div>
      </main>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
