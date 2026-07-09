"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutUser } from "@/app/actions/auth";
import {
  Shield,
  Menu,
  X,
  LayoutDashboard,
  Radio,
  BookOpen,
  FileText,
  Settings,
  LogOut,
  User,
  Activity,
  Cpu,
  Database,
  Terminal,
  ChevronDown
} from "lucide-react";

interface DashboardShellProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
  };
  children: React.ReactNode;
}

export default function DashboardShell({ user, children }: DashboardShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const menuItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Incident Center", href: "/dashboard/incidents", icon: Radio },
    { name: "Knowledge Base", href: "/dashboard/knowledge", icon: BookOpen },
    { name: "Post-Mortems", href: "/dashboard/post-mortems", icon: FileText },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  const handleSignOut = async () => {
    await logoutUser();
  };

  const getRoleLabel = (role?: string | null) => {
    if (!role) return "READ ONLY";
    return role.replace("_", " ").toUpperCase();
  };

  return (
    <div className="relative min-h-screen flex bg-cyber-bg text-cyber-text font-sans">
      
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Component */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 glass-panel border-r border-cyber-border z-30 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:flex md:flex-col
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-cyber-border">
          <Link href="/dashboard" className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-cyber-primary" />
            <span className="font-mono text-lg font-bold tracking-wider text-white">
              SENTINEL<span className="text-cyber-primary">OPS</span>
            </span>
          </Link>
          <button className="md:hidden p-1 text-cyber-muted hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-grow px-4 py-6 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex items-center space-x-3 px-4 py-3 rounded text-sm font-mono transition-all duration-200
                  ${isActive 
                    ? "bg-blue-950/50 text-cyber-primary border-l-2 border-cyber-primary" 
                    : "text-cyber-muted hover:bg-cyber-card/30 hover:text-white"
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Footer Panel */}
        <div className="p-4 border-t border-cyber-border bg-cyber-bg/20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-blue-900/40 border border-cyber-primary/30 flex items-center justify-center text-cyber-primary font-mono font-bold">
              {user.name ? user.name[0].toUpperCase() : "U"}
            </div>
            <div className="flex-grow overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">{user.name || "Operative"}</p>
              <p className="text-xs text-cyber-primary/70 font-mono tracking-tighter truncate">
                {getRoleLabel(user.role)}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-grow flex flex-col min-w-0">
        
        {/* Top Navigation Header */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-cyber-border glass-panel z-10">
          {/* Menu Toggle */}
          <div className="flex items-center space-x-4">
            <button className="md:hidden p-1 text-cyber-muted hover:text-white" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden sm:flex items-center space-x-2 text-xs font-mono text-cyber-muted">
              <span>SECURITY COGNITIVE PROCESSOR ACTIVE</span>
            </div>
          </div>

          {/* Status Badges & Dropdown */}
          <div className="flex items-center space-x-6">
            
            {/* Status Badges */}
            <div className="hidden lg:flex items-center space-x-4 text-xs font-mono">
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-emerald-950/20 border border-cyber-success/30 text-cyber-success">
                <Database className="w-3.5 h-3.5" />
                <span>NEON: ONLINE</span>
              </div>
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-blue-950/20 border border-cyber-primary/30 text-cyber-primary">
                <Terminal className="w-3.5 h-3.5" />
                <span>QDRANT: ACTIVE</span>
              </div>
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-purple-950/20 border border-purple-500/30 text-purple-400">
                <Cpu className="w-3.5 h-3.5" />
                <span>GEMINI: ACTIVE</span>
              </div>
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-rose-950/20 border border-cyber-danger/30 text-cyber-danger">
                <Activity className="w-3.5 h-3.5" />
                <span>ENKRYPT AI: SAFE</span>
              </div>
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center space-x-2 p-1.5 rounded hover:bg-cyber-card/30 transition-all duration-200"
              >
                <div className="w-7 h-7 rounded-full bg-blue-900/40 border border-cyber-primary/40 flex items-center justify-center text-cyber-primary text-xs font-mono font-bold">
                  {user.name ? user.name[0].toUpperCase() : "U"}
                </div>
                <ChevronDown className="w-4 h-4 text-cyber-muted" />
              </button>

              {profileDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setProfileDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 glass-panel border border-cyber-border rounded shadow-2xl py-2 z-20 font-mono text-xs">
                    <div className="px-4 py-3 border-b border-cyber-border">
                      <p className="font-semibold text-white">{user.name}</p>
                      <p className="text-cyber-muted truncate">{user.email}</p>
                      <span className="inline-block mt-2 px-2 py-0.5 rounded bg-blue-950/50 border border-cyber-primary/30 text-cyber-primary tracking-tighter">
                        {getRoleLabel(user.role)}
                      </span>
                    </div>
                    
                    <Link href="/dashboard/profile" className="flex items-center space-x-2 px-4 py-3 hover:bg-cyber-card/30 text-cyber-muted hover:text-white transition-colors duration-150">
                      <User className="w-4 h-4" />
                      <span>Security Profile</span>
                    </Link>

                    <button 
                      onClick={handleSignOut}
                      className="w-full flex items-center space-x-2 px-4 py-3 hover:bg-red-950/30 text-cyber-danger hover:text-red-200 transition-colors duration-150 text-left border-t border-cyber-border"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out Operator</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Panel */}
        <main className="flex-grow p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
