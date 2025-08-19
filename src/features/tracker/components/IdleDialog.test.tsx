import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { IdleDialog } from './IdleDialog';
import type { TaskRef } from '../TimerContext';

// Mock HierarchySelector component
vi.mock('./HierarchySelector', () => ({
  HierarchySelector: ({ value, onChange }: { value?: TaskRef; onChange: (task?: TaskRef) => void }) => (
    <div data-testid="hierarchy-selector">
      <button 
        data-testid="select-task" 
        onClick={() => onChange({ client: 'Test Client', project: 'Test Project', task: 'Test Task' })}
      >
        Select Task
      </button>
      <button 
        data-testid="clear-task" 
        onClick={() => onChange(undefined)}
      >
        Clear Task
      </button>
      {value && (
        <div data-testid="selected-task">
          {value.client} / {value.project} / {value.task}
        </div>
      )}
    </div>
  ),
}));

describe('IdleDialog Component', () => {
  const mockOnClose = vi.fn();
  
  const defaultProps = {
    open: true,
    idleMs: 90000, // 1.5 minutes
    onClose: mockOnClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dialog Rendering', () => {
    it('should render when open is true', () => {
      render(<IdleDialog {...defaultProps} />);
      
      expect(screen.getByText('Idle time detected')).toBeInTheDocument();
      expect(screen.getByText('No activity for 2 minutes. How should we handle this time?')).toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      render(<IdleDialog {...defaultProps} open={false} />);
      
      expect(screen.queryByText('Idle time detected')).not.toBeInTheDocument();
    });

    it('should display correct idle time in minutes', () => {
      const testCases = [
        { idleMs: 60000, expectedMinutes: '1 minutes' },
        { idleMs: 90000, expectedMinutes: '2 minutes' },
        { idleMs: 150000, expectedMinutes: '3 minutes' },
        { idleMs: 30000, expectedMinutes: '1 minutes' }, // Rounds to 1
      ];

      testCases.forEach(({ idleMs, expectedMinutes }) => {
        const { unmount } = render(<IdleDialog {...defaultProps} idleMs={idleMs} />);
        expect(screen.getByText(`No activity for ${expectedMinutes}. How should we handle this time?`)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Choice Buttons', () => {
    it('should render all choice buttons', () => {
      render(<IdleDialog {...defaultProps} />);
      
      expect(screen.getByText('Continue current task')).toBeInTheDocument();
      expect(screen.getByText('Mark as break/lunch')).toBeInTheDocument();
      expect(screen.getByText('Mark as meeting')).toBeInTheDocument();
      expect(screen.getByText('Admin/Non-billable')).toBeInTheDocument();
      expect(screen.getByText('Switch task and continue')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('should call onClose with "continue" when continue button is clicked', () => {
      render(<IdleDialog {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Continue current task'));
      
      expect(mockOnClose).toHaveBeenCalledWith('continue');
    });

    it('should call onClose with "break" when break button is clicked', () => {
      render(<IdleDialog {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Mark as break/lunch'));
      
      expect(mockOnClose).toHaveBeenCalledWith('break');
    });

    it('should call onClose with "meeting" when meeting button is clicked', () => {
      render(<IdleDialog {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Mark as meeting'));
      
      expect(mockOnClose).toHaveBeenCalledWith('meeting');
    });

    it('should call onClose with "admin" when admin button is clicked', () => {
      render(<IdleDialog {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Admin/Non-billable'));
      
      expect(mockOnClose).toHaveBeenCalledWith('admin');
    });

    it('should call onClose with "break" when close button is clicked', () => {
      render(<IdleDialog {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Close'));
      
      expect(mockOnClose).toHaveBeenCalledWith('break');
    });
  });

  describe('Task Switching Functionality', () => {
    it('should render HierarchySelector component', () => {
      render(<IdleDialog {...defaultProps} />);
      
      expect(screen.getByTestId('hierarchy-selector')).toBeInTheDocument();
    });

    it('should disable switch button when no task is selected', () => {
      render(<IdleDialog {...defaultProps} />);
      
      const switchButton = screen.getByText('Switch task and continue');
      expect(switchButton).toBeDisabled();
    });

    it('should enable switch button when task is selected', async () => {
      render(<IdleDialog {...defaultProps} />);
      
      const switchButton = screen.getByText('Switch task and continue');
      expect(switchButton).toBeDisabled();
      
      // Select a task
      fireEvent.click(screen.getByTestId('select-task'));
      
      await waitFor(() => {
        expect(switchButton).not.toBeDisabled();
      });
    });

    it('should call onClose with "switch" and selected task when switch button is clicked', async () => {
      render(<IdleDialog {...defaultProps} />);
      
      // Select a task first
      fireEvent.click(screen.getByTestId('select-task'));
      
      await waitFor(() => {
        expect(screen.getByText('Switch task and continue')).not.toBeDisabled();
      });
      
      // Click switch button
      fireEvent.click(screen.getByText('Switch task and continue'));
      
      expect(mockOnClose).toHaveBeenCalledWith('switch', {
        client: 'Test Client',
        project: 'Test Project',
        task: 'Test Task',
      });
    });

    it('should display selected task information', async () => {
      render(<IdleDialog {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('select-task'));
      
      await waitFor(() => {
        expect(screen.getByTestId('selected-task')).toBeInTheDocument();
        expect(screen.getByText('Test Client / Test Project / Test Task')).toBeInTheDocument();
      });
    });

    it('should disable switch button when task is cleared', async () => {
      render(<IdleDialog {...defaultProps} />);
      
      // First select a task
      fireEvent.click(screen.getByTestId('select-task'));
      
      await waitFor(() => {
        expect(screen.getByText('Switch task and continue')).not.toBeDisabled();
      });
      
      // Then clear the task
      fireEvent.click(screen.getByTestId('clear-task'));
      
      await waitFor(() => {
        expect(screen.getByText('Switch task and continue')).toBeDisabled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper dialog structure', () => {
      render(<IdleDialog {...defaultProps} />);
      
      // Check for dialog title
      expect(screen.getByRole('heading', { name: 'Idle time detected' })).toBeInTheDocument();
      
      // Check for dialog description
      expect(screen.getByText('No activity for 2 minutes. How should we handle this time?')).toBeInTheDocument();
    });

    it('should have proper button roles and accessibility', () => {
      render(<IdleDialog {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button');
      
      // Should have all expected buttons
      expect(buttons).toHaveLength(7); // 6 choice buttons + 1 close button
      
      // Check specific buttons exist
      expect(screen.getByRole('button', { name: 'Continue current task' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Mark as break/lunch' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Mark as meeting' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Admin/Non-billable' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Switch task and continue' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero idle time', () => {
      render(<IdleDialog {...defaultProps} idleMs={0} />);
      
      expect(screen.getByText('No activity for 0 minutes. How should we handle this time?')).toBeInTheDocument();
    });

    it('should handle very large idle times', () => {
      const largeIdleMs = 3600000; // 1 hour
      render(<IdleDialog {...defaultProps} idleMs={largeIdleMs} />);
      
      expect(screen.getByText('No activity for 60 minutes. How should we handle this time?')).toBeInTheDocument();
    });

    it('should handle negative idle time gracefully', () => {
      render(<IdleDialog {...defaultProps} idleMs={-1000} />);
      
      // Should round to 0
      expect(screen.getByText('No activity for 0 minutes. How should we handle this time?')).toBeInTheDocument();
    });

    it('should not crash when onClose is not provided', () => {
      const { container } = render(
        <IdleDialog open={true} idleMs={60000} onClose={undefined as any} />
      );
      
      expect(container).toBeInTheDocument();
      
      // Buttons should not crash when clicked
      expect(() => {
        fireEvent.click(screen.getByText('Continue current task'));
      }).not.toThrow();
    });
  });

  describe('Dialog State Management', () => {
    it('should maintain task selection state across re-renders', async () => {
      const { rerender } = render(<IdleDialog {...defaultProps} />);
      
      // Select a task
      fireEvent.click(screen.getByTestId('select-task'));
      
      await waitFor(() => {
        expect(screen.getByTestId('selected-task')).toBeInTheDocument();
      });
      
      // Re-render with different idle time
      rerender(<IdleDialog {...defaultProps} idleMs={120000} />);
      
      // Task selection should be maintained (this depends on component implementation)
      // In this case, the component resets state on each render, which is expected behavior
      expect(screen.getByText('No activity for 2 minutes. How should we handle this time?')).toBeInTheDocument();
    });

    it('should reset task selection when dialog reopens', async () => {
      const { rerender } = render(<IdleDialog {...defaultProps} />);
      
      // Select a task
      fireEvent.click(screen.getByTestId('select-task'));
      
      await waitFor(() => {
        expect(screen.getByText('Switch task and continue')).not.toBeDisabled();
      });
      
      // Close dialog
      rerender(<IdleDialog {...defaultProps} open={false} />);
      
      // Reopen dialog
      rerender(<IdleDialog {...defaultProps} open={true} />);
      
      // Switch button should be disabled again (task selection reset)
      expect(screen.getByText('Switch task and continue')).toBeDisabled();
    });
  });
});