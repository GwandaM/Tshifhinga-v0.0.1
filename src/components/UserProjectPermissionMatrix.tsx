import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { electronDB } from '@/lib/electron-database';
import {
  Shield,
  Search,
  Filter,
  Save,
  Users,
  FolderOpen,
  Eye,
  Clock,
  Edit,
  Settings,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

interface User {
  id: number;
  username: string;
  name?: string;
  surname?: string;
  email: string;
  role: 'admin' | 'user' | 'director';
  team?: string;
  region?: string;
  isActive: boolean;
}

interface Project {
  id: number;
  name: string;
  clientName: string;
  isActive: boolean;
}

interface UserProjectPermission {
  id: number;
  userId: number;
  projectId: number;
  permissionLevel: 'view' | 'track_time' | 'edit' | 'admin';
  username: string;
  projectName: string;
  clientName: string;
  grantedBy?: number;
  createdAt: number;
  isActive: boolean;
}

type PermissionLevel = 'view' | 'track_time' | 'edit' | 'admin';

const PERMISSION_LEVELS: { value: PermissionLevel; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'view',
    label: 'View',
    icon: <Eye className="h-4 w-4" />,
    description: 'Can see project but not track time'
  },
  {
    value: 'track_time',
    label: 'Track Time',
    icon: <Clock className="h-4 w-4" />,
    description: 'Can track time against project tasks'
  },
  {
    value: 'edit',
    label: 'Edit',
    icon: <Edit className="h-4 w-4" />,
    description: 'Can modify project details and tasks'
  },
  {
    value: 'admin',
    label: 'Admin',
    icon: <Settings className="h-4 w-4" />,
    description: 'Full control including permission management'
  },
];

const PERMISSION_COLORS = {
  view: 'bg-gray-100 text-gray-800',
  track_time: 'bg-blue-100 text-blue-800',
  edit: 'bg-green-100 text-green-800',
  admin: 'bg-purple-100 text-purple-800'
};

export function UserProjectPermissionMatrix() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [bulkChanges, setBulkChanges] = useState<Map<string, PermissionLevel>>(new Map());
  const [activeTab, setActiveTab] = useState('matrix');
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [selectedProjects, setSelectedProjects] = useState<Set<number>>(new Set());
  const [bulkPermissionLevel, setBulkPermissionLevel] = useState<PermissionLevel>('track_time');

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await window.electronAPI.auth.getAllUsers();
      return response as User[];
    },
  });

  // Fetch projects
  const { data: hierarchy = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['hierarchy'],
    queryFn: async () => {
      return await electronDB.getHierarchy();
    },
  });

  // Fetch all permissions
  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['user-project-permissions'],
    queryFn: async () => {
      return await electronDB.getAllUserProjectPermissions();
    },
  });

  // Fetch permission templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['permission-templates'],
    queryFn: async () => {
      return await electronDB.getAllPermissionTemplates();
    },
  });

  // Extract projects from hierarchy
  const projects = useMemo(() => {
    const projectList: Project[] = [];
    hierarchy.forEach((client: any) => {
      client.projects?.forEach((project: any) => {
        projectList.push({
          id: project.id,
          name: project.name,
          clientName: client.name,
          isActive: true
        });
      });
    });
    return projectList;
  }, [hierarchy]);

  // Create permission matrix
  const permissionMatrix = useMemo(() => {
    const matrix = new Map<string, PermissionLevel | null>();

    permissions.forEach((permission: UserProjectPermission) => {
      const key = `${permission.userId}-${permission.projectId}`;
      matrix.set(key, permission.permissionLevel);
    });

    return matrix;
  }, [permissions]);

  // Filter users and projects
  const filteredUsers = useMemo(() => {
    if (!users || !Array.isArray(users)) return [];

    return users.filter(user => {
      if (!user) return false;

      const matchesSearch = !searchTerm ||
        (user.username && user.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesTeam = selectedTeam === 'all' || user.team === selectedTeam;

      return matchesSearch && matchesTeam && user.isActive;
    });
  }, [users, searchTerm, selectedTeam]);

  const filteredProjects = useMemo(() => {
    if (!projects || !Array.isArray(projects)) return [];

    return projects.filter(project => {
      if (!project || !project.id) return false;
      const matchesProject = selectedProject === 'all' || project.id.toString() === selectedProject;
      return matchesProject;
    });
  }, [projects, selectedProject]);

  // Get unique teams
  const teams = useMemo(() => {
    if (!users || !Array.isArray(users)) return [];
    const teamSet = new Set(users.map(u => u?.team).filter(Boolean));
    return Array.from(teamSet).sort();
  }, [users]);

  // Bulk permission mutation
  const bulkPermissionMutation = useMutation({
    mutationFn: async (assignments: Array<{ userId: number; projectId: number; permissionLevel: PermissionLevel }>) => {
      await electronDB.bulkSetUserProjectPermissions(assignments, currentUser?.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-project-permissions'] });
      setBulkChanges(new Map());
      toast({
        title: "Success",
        description: "Permissions updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update permissions",
        variant: "destructive",
      });
      console.error('Error updating permissions:', error);
    }
  });

  // Single permission mutation
  const singlePermissionMutation = useMutation({
    mutationFn: async ({ userId, projectId, permissionLevel }: { userId: number; projectId: number; permissionLevel: PermissionLevel | null }) => {
      if (permissionLevel === null) {
        await electronDB.removeUserProjectPermission(userId, projectId);
      } else {
        await electronDB.setUserProjectPermission(userId, projectId, permissionLevel, currentUser?.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-project-permissions'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update permission",
        variant: "destructive",
      });
      console.error('Error updating permission:', error);
    }
  });

  // Template mutations
  const createTemplateMutation = useMutation({
    mutationFn: async ({ name, description, templateData }: { name: string; description: string; templateData: any[] }) => {
      return await electronDB.createPermissionTemplate(name, description, templateData, currentUser?.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-templates'] });
      setShowTemplateDialog(false);
      setTemplateName('');
      setTemplateDescription('');
      toast({
        title: "Success",
        description: "Permission template created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create template",
        variant: "destructive",
      });
    }
  });

  const applyTemplateMutation = useMutation({
    mutationFn: async ({ templateId, userIds }: { templateId: number; userIds: number[] }) => {
      return await electronDB.applyPermissionTemplate(templateId, userIds, currentUser?.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-project-permissions'] });
      toast({
        title: "Success",
        description: "Template applied successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to apply template",
        variant: "destructive",
      });
    }
  });

  const handlePermissionChange = (userId: number, projectId: number, permissionLevel: PermissionLevel | null) => {
    const key = `${userId}-${projectId}`;

    if (permissionLevel === null) {
      setBulkChanges(prev => {
        const updated = new Map(prev);
        updated.delete(key);
        return updated;
      });
    } else {
      setBulkChanges(prev => new Map(prev).set(key, permissionLevel));
    }
  };

  const applyBulkChanges = () => {
    const assignments = Array.from(bulkChanges.entries()).map(([key, permissionLevel]) => {
      const [userId, projectId] = key.split('-').map(Number);
      return { userId, projectId, permissionLevel };
    });

    bulkPermissionMutation.mutate(assignments);
  };

  const applyImmediateChange = (userId: number, projectId: number, permissionLevel: PermissionLevel | null) => {
    singlePermissionMutation.mutate({ userId, projectId, permissionLevel });
  };

  // Advanced bulk operations
  const applyBulkToSelection = () => {
    const assignments: Array<{ userId: number; projectId: number; permissionLevel: PermissionLevel }> = [];

    selectedUsers.forEach(userId => {
      selectedProjects.forEach(projectId => {
        assignments.push({ userId, projectId, permissionLevel: bulkPermissionLevel });
      });
    });

    if (assignments.length > 0) {
      bulkPermissionMutation.mutate(assignments);
      setSelectedUsers(new Set());
      setSelectedProjects(new Set());
    }
  };

  const removeAllPermissionsForSelection = () => {
    const removals: Array<{ userId: number; projectId: number; permissionLevel: PermissionLevel | null }> = [];

    selectedUsers.forEach(userId => {
      selectedProjects.forEach(projectId => {
        removals.push({ userId, projectId, permissionLevel: null });
      });
    });

    if (removals.length > 0) {
      // Use single permission mutation for removals
      removals.forEach(removal => {
        singlePermissionMutation.mutate(removal);
      });
      setSelectedUsers(new Set());
      setSelectedProjects(new Set());
    }
  };

  const selectAllUsers = () => {
    setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
  };

  const selectAllProjects = () => {
    setSelectedProjects(new Set(filteredProjects.map(p => p.id)));
  };

  const clearSelections = () => {
    setSelectedUsers(new Set());
    setSelectedProjects(new Set());
  };

  const createTemplateFromSelection = () => {
    if (selectedUsers.size === 0 || selectedProjects.size === 0) {
      toast({
        title: "Error",
        description: "Please select users and projects first",
        variant: "destructive",
      });
      return;
    }
    setShowTemplateDialog(true);
  };

  const saveTemplate = () => {
    if (!templateName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a template name",
        variant: "destructive",
      });
      return;
    }

    const templateData = Array.from(selectedProjects).map(projectId => ({
      projectId,
      permissionLevel: bulkPermissionLevel
    }));

    createTemplateMutation.mutate({
      name: templateName,
      description: templateDescription,
      templateData
    });
  };

  const applyTemplate = (templateId: number) => {
    if (selectedUsers.size === 0) {
      toast({
        title: "Error",
        description: "Please select users to apply the template to",
        variant: "destructive",
      });
      return;
    }

    applyTemplateMutation.mutate({
      templateId,
      userIds: Array.from(selectedUsers)
    });
  };

  const getPermissionForUser = (userId: number, projectId: number): PermissionLevel | null => {
    const key = `${userId}-${projectId}`;
    const bulkChange = bulkChanges.get(key);
    if (bulkChange !== undefined) {
      return bulkChange;
    }
    return permissionMatrix.get(key) || null;
  };

  const getInitials = (name?: string, username?: string): string => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return username?.slice(0, 2).toUpperCase() || 'UN';
  };

  if (usersLoading || projectsLoading || permissionsLoading || templatesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-8 w-8 animate-pulse mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            User Project Permissions
          </h2>
          <p className="text-muted-foreground">
            Manage user access to projects with granular permission levels
          </p>
        </div>

        <div className="flex items-center gap-2">
          {bulkChanges.size > 0 && (
            <>
              <Badge variant="outline" className="bg-yellow-50">
                {bulkChanges.size} pending changes
              </Badge>
              <Button
                onClick={applyBulkChanges}
                disabled={bulkPermissionMutation.isPending}
                className="gap-2"
                size="sm"
              >
                <Save className="h-4 w-4" />
                Apply Changes
              </Button>
            </>
          )}

          {(selectedUsers.size > 0 || selectedProjects.size > 0) && (
            <>
              <Badge variant="outline" className="bg-blue-50">
                {selectedUsers.size} users × {selectedProjects.size} projects selected
              </Badge>
              <Button
                onClick={clearSelections}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                Clear Selection
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map(team => (
                  <SelectItem key={team} value={team}>{team}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Filter by project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.clientName} / {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Permission Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Permission Levels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {PERMISSION_LEVELS.map(level => (
              <div key={level.value} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className={`p-2 rounded-lg ${PERMISSION_COLORS[level.value]}`}>
                  {level.icon}
                </div>
                <div>
                  <div className="font-medium">{level.label}</div>
                  <div className="text-sm text-muted-foreground">{level.description}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Operations Panel */}
      {(selectedUsers.size > 0 && selectedProjects.size > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Bulk Operations
              <Badge variant="outline">
                {selectedUsers.size} users × {selectedProjects.size} projects = {selectedUsers.size * selectedProjects.size} assignments
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Permission Level:</label>
                <Select value={bulkPermissionLevel} onValueChange={(value: PermissionLevel) => setBulkPermissionLevel(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERMISSION_LEVELS.map(level => (
                      <SelectItem key={level.value} value={level.value}>
                        <div className="flex items-center gap-2">
                          {level.icon}
                          {level.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={applyBulkToSelection}
                disabled={bulkPermissionMutation.isPending}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Apply to Selection
              </Button>

              <Button
                onClick={removeAllPermissionsForSelection}
                disabled={singlePermissionMutation.isPending}
                variant="destructive"
                className="gap-2"
              >
                <AlertCircle className="h-4 w-4" />
                Remove All Permissions
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permission Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Permission Matrix
            <Badge variant="outline">{filteredUsers.length} users × {filteredProjects.length} projects</Badge>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                onClick={selectAllUsers}
                variant="outline"
                size="sm"
                disabled={filteredUsers.length === 0}
              >
                Select All Users
              </Button>
              <Button
                onClick={selectAllProjects}
                variant="outline"
                size="sm"
                disabled={filteredProjects.length === 0}
              >
                Select All Projects
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 || filteredProjects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>No users or projects match the current filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium sticky left-0 bg-background z-10 min-w-64">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAllUsers();
                            } else {
                              setSelectedUsers(new Set());
                            }
                          }}
                        />
                        User
                      </div>
                    </th>
                    {filteredProjects.map(project => (
                      <th key={project.id} className="text-center p-3 font-medium min-w-32">
                        <div className="space-y-1">
                          <Checkbox
                            checked={selectedProjects.has(project.id)}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedProjects);
                              if (checked) {
                                newSelected.add(project.id);
                              } else {
                                newSelected.delete(project.id);
                              }
                              setSelectedProjects(newSelected);
                            }}
                          />
                          <div className="font-medium">{project.name}</div>
                          <div className="text-xs text-muted-foreground">{project.clientName}</div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 sticky left-0 bg-background z-10">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedUsers.has(user.id)}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedUsers);
                              if (checked) {
                                newSelected.add(user.id);
                              } else {
                                newSelected.delete(user.id);
                              }
                              setSelectedUsers(newSelected);
                            }}
                          />
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(user.name, user.username)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.name || user.username}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              {user.team && <Badge variant="outline" className="text-xs">{user.team}</Badge>}
                              <span>{user.role}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      {filteredProjects.map(project => {
                        const currentPermission = getPermissionForUser(user.id, project.id);
                        const key = `${user.id}-${project.id}`;
                        const hasChanges = bulkChanges.has(key);

                        return (
                          <td key={project.id} className="p-3 text-center">
                            <Select
                              value={currentPermission || 'none'}
                              onValueChange={(value: string) => {
                                const newLevel = value === 'none' ? null : value as PermissionLevel;
                                if (bulkChanges.size === 0) {
                                  // Apply immediately if no bulk changes pending
                                  applyImmediateChange(user.id, project.id, newLevel);
                                } else {
                                  // Add to bulk changes
                                  handlePermissionChange(user.id, project.id, newLevel);
                                }
                              }}
                            >
                              <SelectTrigger className={`w-28 ${hasChanges ? 'border-yellow-500 bg-yellow-50' : ''}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {PERMISSION_LEVELS.map(level => (
                                  <SelectItem key={level.value} value={level.value}>
                                    <div className="flex items-center gap-2">
                                      {level.icon}
                                      {level.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {hasChanges && (
                              <div className="mt-1">
                                <Badge variant="outline" className="text-xs bg-yellow-100">
                                  Changed
                                </Badge>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default UserProjectPermissionMatrix;