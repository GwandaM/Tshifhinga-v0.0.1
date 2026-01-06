import React, { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";

import { TimerProvider } from "@/features/tracker/TimerContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import { MiniWindow } from "@/components/MiniWindow";
import { TaskSelector } from "@/components/TaskSelector";

import { Navbar } from "@/components/Navbar";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import CalendarPage from "./pages/Calendar";
import UserManagement from "./pages/admin/UserManagement";
import ActivityMonitoring from "./pages/admin/ActivityMonitoring";
import ProjectManagement from "./pages/admin/ProjectManagement";
import SyncManagement from "./pages/admin/SyncManagement";

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

  useEffect(() => {
    if (windowMode === 'mini') {
      document.body.classList.add('mini-mode');
    } else {
      document.body.classList.remove('mini-mode');
    }
  }, [windowMode]);




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
                  <div className="min-h-screen flex flex-col bg-background">
                    {!isFullScreen && <Navbar />}

                    <main className="flex-1">
                      <ProtectedRoute>
                        <Routes>
                          <Route path="/" element={<Index />} />
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/calendar" element={<CalendarPage />} />
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
                          <Route
                            path="/admin/sync"
                            element={
                              <ProtectedRoute requiredPermission="manage_users">
                                <SyncManagement />
                              </ProtectedRoute>
                            }
                          />
                          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                          <Route path="*" element={<Index />} />
                        </Routes>
                      </ProtectedRoute>
                    </main>
                  </div>
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
