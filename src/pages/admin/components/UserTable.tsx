import React, { useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Avatar, AvatarFallback } from '../../../components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../components/ui/alert-dialog';
import { 
  MoreVertical, 
  Edit, 
  UserX, 
  Shield, 
  User, 
  Trash2,
  UserCheck,
  Mail
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/ui/use-toast';

interface UserData {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: number;
}

interface UserTableProps {
  users: UserData[];
  onEditUser: (user: UserData) => void;
  onUserUpdated: () => void;
}

export function UserTable({ users, onEditUser, onUserUpdated }: UserTableProps) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: UserData | null }>({
    open: false,
    user: null,
  });
  const [loadingActions, setLoadingActions] = useState<Set<number>>(new Set());

  const getInitials = (username: string) => {
    return username
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleToggleUserStatus = async (user: UserData) => {
    if (user.id === currentUser?.id) {
      toast({
        title: "Cannot modify own account",
        description: "You cannot deactivate your own account",
        variant: "destructive",
      });
      return;
    }

    setLoadingActions(prev => new Set(prev).add(user.id));

    try {
      if (user.isActive) {
        // Deactivate user
        const success = await window.electronAPI.auth.deactivateUser(user.id);
        if (success) {
          toast({
            title: "User deactivated",
            description: `${user.username} has been deactivated`,
          });
          onUserUpdated();
        } else {
          throw new Error('Failed to deactivate user');
        }
      } else {
        // Note: We would need to add an "activateUser" method to the backend
        // For now, we'll show a message that this feature needs implementation
        toast({
          title: "Feature not implemented",
          description: "User reactivation needs to be implemented in the backend",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${user.isActive ? 'deactivate' : 'activate'} user`,
        variant: "destructive",
      });
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(user.id);
        return newSet;
      });
    }
  };

  const handleToggleRole = async (user: UserData) => {
    if (user.id === currentUser?.id) {
      toast({
        title: "Cannot modify own role",
        description: "You cannot change your own role",
        variant: "destructive",
      });
      return;
    }

    setLoadingActions(prev => new Set(prev).add(user.id));

    try {
      const newRole = user.role === 'admin' ? 'user' : 'admin';
      const success = await window.electronAPI.auth.updateUserRole(user.id, newRole);
      
      if (success) {
        toast({
          title: "Role updated",
          description: `${user.username} is now ${newRole === 'admin' ? 'an administrator' : 'a regular user'}`,
        });
        onUserUpdated();
      } else {
        throw new Error('Failed to update role');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(user.id);
        return newSet;
      });
    }
  };

  const handleDeleteUser = async (user: UserData) => {
    if (user.id === currentUser?.id) {
      toast({
        title: "Cannot delete own account",
        description: "You cannot delete your own account",
        variant: "destructive",
      });
      setDeleteDialog({ open: false, user: null });
      return;
    }

    setLoadingActions(prev => new Set(prev).add(user.id));

    try {
      // Since we don't have a delete method, we'll deactivate instead
      const success = await window.electronAPI.auth.deactivateUser(user.id);
      
      if (success) {
        toast({
          title: "User removed",
          description: `${user.username} has been removed from the system`,
        });
        onUserUpdated();
      } else {
        throw new Error('Failed to remove user');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove user",
        variant: "destructive",
      });
    } finally {
      setLoadingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(user.id);
        return newSet;
      });
      setDeleteDialog({ open: false, user: null });
    }
  };

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <User className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No users found</h3>
        <p className="text-muted-foreground">
          No users match your current search and filter criteria.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]"></TableHead>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getInitials(user.username)}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                
                <TableCell className="font-medium">
                  <div className="flex items-center space-x-2">
                    <span>{user.username}</span>
                    {user.id === currentUser?.id && (
                      <Badge variant="outline" className="text-xs">
                        You
                      </Badge>
                    )}
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span>{user.email}</span>
                  </div>
                </TableCell>
                
                <TableCell>
                  <Badge 
                    variant={user.role === 'admin' ? 'destructive' : 'secondary'}
                    className="capitalize"
                  >
                    {user.role === 'admin' && <Shield className="mr-1 h-3 w-3" />}
                    {user.role}
                  </Badge>
                </TableCell>
                
                <TableCell>
                  <Badge variant={user.isActive ? 'default' : 'secondary'}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                
                <TableCell className="text-muted-foreground">
                  {format(new Date(user.createdAt), 'MMM d, yyyy')}
                </TableCell>
                
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="h-8 w-8 p-0"
                        disabled={loadingActions.has(user.id)}
                      >
                        <span className="sr-only">Open menu</span>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem onClick={() => onEditUser(user)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit User
                      </DropdownMenuItem>
                      
                      {user.id !== currentUser?.id && (
                        <>
                          <DropdownMenuItem onClick={() => handleToggleRole(user)}>
                            {user.role === 'admin' ? (
                              <>
                                <User className="mr-2 h-4 w-4" />
                                Make User
                              </>
                            ) : (
                              <>
                                <Shield className="mr-2 h-4 w-4" />
                                Make Admin
                              </>
                            )}
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={() => handleToggleUserStatus(user)}>
                            {user.isActive ? (
                              <>
                                <UserX className="mr-2 h-4 w-4" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <UserCheck className="mr-2 h-4 w-4" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setDeleteDialog({ open: true, user })}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove User
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={deleteDialog.open} 
        onOpenChange={(open) => setDeleteDialog({ open, user: deleteDialog.user })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteDialog.user?.username}</strong>? 
              This will deactivate their account and they will no longer be able to access the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteDialog.user && handleDeleteUser(deleteDialog.user)}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}