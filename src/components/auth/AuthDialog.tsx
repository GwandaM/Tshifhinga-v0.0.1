import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { VisuallyHidden } from '../ui/visually-hidden';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'login' | 'register';
}

export function AuthDialog({ open, onOpenChange, defaultTab = 'login' }: AuthDialogProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(defaultTab);

  const handleSuccess = () => {
    onOpenChange(false);
  };

  const switchToRegister = () => setActiveTab('register');
  const switchToLogin = () => setActiveTab('login');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <VisuallyHidden>
            <DialogTitle>
              {activeTab === 'login' ? 'Sign In' : 'Create Account'}
            </DialogTitle>
          </VisuallyHidden>
        </DialogHeader>
        
        {activeTab === 'login' ? (
          <LoginForm
            onSuccess={handleSuccess}
            onSwitchToRegister={switchToRegister}
          />
        ) : (
          <RegisterForm
            onSuccess={() => {
              // After successful registration, switch to login
              setActiveTab('login');
            }}
            onSwitchToLogin={switchToLogin}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}