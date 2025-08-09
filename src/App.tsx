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
import { ThemeToggle } from "@/components/theme-toggle";
import { MiniWindow } from "@/components/MiniWindow";
import { Button } from "@/components/ui/button";
import { Minimize2 } from "lucide-react";
import Index from "./pages/Index";
import CalendarPage from "./pages/Calendar";
import Reports from "./pages/Reports";

const queryClient = new QueryClient();

const App = () => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [windowMode, setWindowMode] = useState<'full' | 'mini' | 'tray'>('full');

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  // Detect window mode from URL params or electron API
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode') as 'full' | 'mini' | null;
    
    if (mode === 'mini') {
      setWindowMode('mini');
    } else if ((window as any).electronAPI?.window) {
      // Get mode from electron if available
      (window as any).electronAPI.window.getMode().then((mode: string) => {
        setWindowMode(mode as 'full' | 'mini' | 'tray');
      });
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
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <TimerProvider>
              <MiniWindow />
            </TimerProvider>
          </TooltipProvider>
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
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <TimerProvider>
              <BrowserRouter>
                <SidebarProvider defaultOpen={false}>
                  {!isFullScreen && (
                    <header className="h-12 flex items-center justify-between gap-3 border-b px-3 bg-background">
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
                  <div className="flex min-h-screen w-full">
                    {!isFullScreen && <AppSidebar />}
                    <main className="flex-1">
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/calendar" element={<CalendarPage />} />
                        <Route path="/reports" element={<Reports />} />
                        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                        <Route path="*" element={<Index />} />
                      </Routes>
                    </main>
                  </div>
                </SidebarProvider>
              </BrowserRouter>
            </TimerProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
