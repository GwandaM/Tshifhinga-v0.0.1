import { render, screen, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import React, { useState } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { TimerProvider, useTimer } from './TimerContext';

// Mock the electronDB API
vi.mock('@/lib/electron-database', () => ({
  electronDB: {
    getAllSessions: vi.fn().mockResolvedValue([]),
    getUserSessions: vi.fn().mockResolvedValue([]),
    updateSession: vi.fn().mockResolvedValue(undefined),
    insertSession: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock the global electronAPI
const mockElectronAPI = {
  timer: {
    getState: vi.fn().mockResolvedValue({ status: 'stopped', activeMs: 0, pausedMs: 0 }),
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn().mockResolvedValue(undefined),
    adjustTime: vi.fn(),
    onStateSync: vi.fn(() => () => {}), // Return a cleanup function
    onTimerAction: vi.fn(() => () => {}),
  },
  powerMonitor: {
    onSystemSuspend: vi.fn(() => () => {}),
    onScreenLock: vi.fn(() => () => {}),
    onSystemResume: vi.fn(() => () => {}),
    onScreenUnlock: vi.fn(() => () => {}),
  },
};
global.window.electronAPI = mockElectronAPI;

// Mock AuthContext
const mockAuthContextValue = {
  user: { id: 1, username: 'testuser', role: 'user' },
  token: 'test-token',
  login: vi.fn(), logout: vi.fn(), register: vi.fn(),
  hasPermission: () => true, isAuthenticated: true, isLoading: false,
};

// --- Test Component & Renderer ---
const TestComponent = () => {
  const { status, idleDialog, handleIdleChoice, start, timerStateRef, idleStartRef } = useTimer();
  return (
    <div>
      <div data-testid="status">{status}</div>
      <button onClick={() => {
        timerStateRef.current = { status: 'running', task: { client: 'c', project: 'p', task: 't' } };
        idleStartRef.current = Date.now() - 70000;
        handleIdleChoice('break');
      }}>Test Break</button>
    </div>
  );
};

const renderWithProviders = () => {
  return render(
    <AuthContext.Provider value={mockAuthContextValue}>
      <TimerProvider><TestComponent /></TimerProvider>
    </AuthContext.Provider>
  );
};

// --- Tests ---
describe('TimerContext Idle Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call adjustTime and stop when user chooses break', async () => {
    renderWithProviders();

    await act(async () => {
      screen.getByText('Test Break').click();
    });

    expect(mockElectronAPI.timer.adjustTime).toHaveBeenCalledWith(expect.any(Number));
    expect(mockElectronAPI.timer.stop).toHaveBeenCalled();
  });
});
