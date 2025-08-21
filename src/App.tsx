import React, { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TimerProvider } from "@/features/tracker/TimerContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ThemeToggle } from "@/components/theme-toggle";
import { MiniWindow } from "@/components/MiniWindow";
import { TaskSelector } from "@/components/TaskSelector";
import { Button } from "@/components/ui/button";
import { Minimize2 } from "lucide-react";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import CalendarPage from "./pages/Calendar";
import FinancialAnalytics from "./pages/analytics/FinancialAnalytics";
import TeamAnalytics from "./pages/analytics/TeamAnalytics";
import UserManagement from "./pages/admin/UserManagement";
import ActivityMonitoring from "./pages/admin/ActivityMonitoring";
import ProjectManagement from "./pages/admin/ProjectManagement";

const queryClient = new QueryClient();

const App = () => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [windowMode, setWindowMode] = useState<'full' | 'mini' | 'tray' | 'taskSelector'>('full');

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  // Detect window mode from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode') as 'full' | 'mini' | 'taskSelector' | null;
    
    if (mode === 'mini') {
      setWindowMode('mini');
    } else if (mode === 'taskSelector') {
      setWindowMode('taskSelector');
    } else {
      setWindowMode('full');
    }
  }, []);

  const switchToMini = () => {
    if ((window as any).electronAPI?.window) {
      (window as any).electronAPI.window.switchToMini();
    }
  };


  // If in mini mode, render mini window
  if (windowMode === 'mini') {
    return (
      <ErrorBoundary>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <TimerProvider>
                  <MiniWindow />
                </TimerProvider>
              </TooltipProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  // If in task selector mode, render task selector
  if (windowMode === 'taskSelector') {
    return (
      <ErrorBoundary>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <TaskSelector
                  onTaskSelect={(task) => {
                    // Send selected task to main process
                    (window as any).electronAPI?.timer.selectTask(task);
                  }}
                  onCancel={() => {
                    // Close the task selector window
                    (window as any).electronAPI?.window.closeTaskSelector();
                  }}
                />
              </TooltipProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <TimerProvider>
              <BrowserRouter>
                <SidebarProvider defaultOpen={false}>
                  <div className="min-h-screen w-full">
                    {/* Fixed Header */}
                    {!isFullScreen && (
                      <header className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center justify-between gap-3 border-b px-4 bg-background">
                        <div className="flex items-center gap-3">
                          <SidebarTrigger className="h-8 w-8 border rounded-md hover:bg-accent hover:text-accent-foreground" />
                          <NavLink to="/" className="text-sm font-semibold tracking-tight">Tshifhinga</NavLink>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={switchToMini}
                            className="h-8 px-3 text-xs"
                            title="Switch to Mini View"
                          >
                            <Minimize2 className="h-3 w-3 mr-1" />
                            Mini View
                          </Button>
                          <ThemeToggle />
                        </div>
                      </header>
                    )}
                    
                    {/* Main Layout */}
                    <div className="flex" style={{ marginTop: isFullScreen ? '0' : '48px' }}>
                      {!isFullScreen && <AppSidebar />}
                      <main className="flex-1 min-h-screen">
                      <ProtectedRoute>
                        <Routes>
                          <Route path="/" element={<Index />} />
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/calendar" element={<CalendarPage />} />
                          <Route path="/analytics/financial" element={<FinancialAnalytics />} />
                          <Route 
                            path="/analytics/team" 
                            element={
                              <ProtectedRoute requiredPermission="view_all_sessions">
                                <TeamAnalytics />
                              </ProtectedRoute>
                            } 
                          />
                          <Route 
                            path="/admin/users" 
                            element={
                              <ProtectedRoute requiredPermission="manage_users">
                                <UserManagement />
                              </ProtectedRoute>
                            } 
                          />
                          <Route 
                            path="/admin/activity" 
                            element={
                              <ProtectedRoute requiredPermission="view_all_sessions">
                                <ActivityMonitoring />
                              </ProtectedRoute>
                            } 
                          />
                          <Route 
                            path="/admin/projects" 
                            element={
                              <ProtectedRoute requiredPermission="manage_projects">
                                <ProjectManagement />
                              </ProtectedRoute>
                            } 
                          />
                          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                          <Route path="*" element={<Index />} />
                        </Routes>
                      </ProtectedRoute>
                      </main>
                    </div>
                  </div>
                </SidebarProvider>
              </BrowserRouter>
              </TimerProvider>
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
