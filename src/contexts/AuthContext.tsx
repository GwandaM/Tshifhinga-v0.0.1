import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, password: string, role?: 'admin' | 'user') => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasPermission: (action: string, resource?: any) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export { AuthContext };

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token from localStorage on startup
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem('auth_token');
        if (storedToken) {
          const userData = await window.electronAPI.auth.verifyToken(storedToken);
          if (userData) {
            setUser(userData);
            setToken(storedToken);
          } else {
            // Token is invalid, remove it
            localStorage.removeItem('auth_token');
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        localStorage.removeItem('auth_token');
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await window.electronAPI.auth.login(username, password);
      
      if (response.success && response.user && response.token) {
        setUser(response.user);
        setToken(response.token);
        localStorage.setItem('auth_token', response.token);
        return { success: true };
      } else {
        return { success: false, error: response.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string, role: 'admin' | 'user' = 'user') => {
    setIsLoading(true);
    try {
      const response = await window.electronAPI.auth.register(username, email, password, role);
      
      if (response.success) {
        return { success: true };
      } else {
        return { success: false, error: response.error || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Registration failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
  };

  const hasPermission = useCallback((action: string, resource?: any): boolean => {
    if (!user) return false;
    
    // Admin users have all permissions
    if (user.role === 'admin') return true;
    
    // Define permission rules for regular users
    switch (action) {
      case 'view_sessions':
        return true; // Users can view their own sessions
      case 'create_session':
        return true; // Users can create sessions
      case 'edit_session':
        return true; // Users can edit their own sessions (this would need session ownership check)
      case 'delete_session':
        return true; // Users can delete their own sessions (this would need session ownership check)
      case 'view_reports':
        return true; // Users can view reports for their accessible projects
      case 'manage_users':
        return false; // Only admins can manage users
      case 'manage_projects':
        return false; // Only admins can manage projects
      case 'view_all_sessions':
        return false; // Only admins can view all sessions
      default:
        return false;
    }
  }, [user]);

  const isAuthenticated = !!user && !!token;

  const value: AuthContextType = {
    user,
    token,
    login,
    register,
    logout,
    isLoading,
    isAuthenticated,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}