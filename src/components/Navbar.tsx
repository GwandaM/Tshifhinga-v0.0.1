
import React from 'react';
import { NavLink, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/auth/UserMenu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Minimize2, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navbar() {
    const { hasPermission } = useAuth();

    const navLinks = [
        { title: "Dashboard", url: "/dashboard" },
        { title: "Timer", url: "/" },
        { title: "Calendar", url: "/calendar" },
    ];

    const adminLinks = [
        { title: "Team", url: "/admin/users", permission: "manage_users" },
        { title: "Reports", url: "/admin/activity", permission: "view_all_sessions" },
        { title: "Projects", url: "/admin/projects", permission: "manage_projects" },
    ];

    const visibleAdminLinks = adminLinks.filter(link => hasPermission(link.permission));
    const allLinks = [...navLinks, ...visibleAdminLinks];

    const switchToMini = () => {
        if ((window as any).electronAPI?.window) {
            (window as any).electronAPI.window.switchToMini();
        }
    };

    return (
        <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container relative flex h-16 items-center justify-between px-4">
                {/* Left: Branding */}
                <div className="flex items-center">
                    <Link to="/" className="flex items-center space-x-2">
                        <span className="text-xl font-bold tracking-tight">
                            Tshifhinga
                        </span>
                    </Link>
                </div>

                {/* Center: Navigation - Absolute Center */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <nav className="flex items-center space-x-1">
                        {allLinks.map((link) => (
                            <NavLink
                                key={link.url}
                                to={link.url}
                                className={({ isActive }) =>
                                    cn(
                                        "relative px-4 py-2 text-sm font-medium transition-all duration-200 rounded-full",
                                        isActive
                                            ? "text-[#a3e635] text-shadow-sm"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                    )
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <span className="relative z-10">{link.title}</span>
                                        {isActive && (
                                            <div className="absolute inset-0 rounded-full bg-[#a3e635]/10 dark:bg-[#a3e635]/20 blur-sm" />
                                        )}
                                        {isActive && (
                                            <div className="absolute inset-x-2 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-[#a3e635] to-transparent opacity-50 blur-[1px]" />
                                        )}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    {/* User Profile */}
                    <UserMenu />

                    {/* Mini View */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={switchToMini}
                        title="Switch to Mini View"
                        className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    >
                        <Minimize2 className="h-5 w-5" />
                        <span className="sr-only">Mini View</span>
                    </Button>

                    {/* Settings */}
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                        <Settings className="h-5 w-5" />
                        <span className="sr-only">Settings</span>
                    </Button>

                    {/* Theme Toggle */}
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
