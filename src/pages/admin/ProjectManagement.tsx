import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { 
  Building2, 
  FolderOpen, 
  CheckSquare, 
  Download,
  BarChart3,
  Shield,
  UserX,
  Plus,
  Zap
} from 'lucide-react';
import { ClientsTab } from './components/ClientsTab';
import { ProjectsTab } from './components/ProjectsTab';
import { TasksTab } from './components/TasksTab';
import { UserProjectPermissionMatrix } from '@/components/UserProjectPermissionMatrix';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function ProjectManagement() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('clients');
  
  // Quick Add states
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<'client' | 'project' | 'task'>('client');
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddParent, setQuickAddParent] = useState('');

  // Fetch stats for overview cards with activity analysis
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['project-stats'],
    queryFn: async () => {
      const [clients, hierarchy, allSessions] = await Promise.all([
        window.electronAPI.database.getAllClients(),
        window.electronAPI.database.getHierarchy(),
        window.electronAPI.database.getAllSessions()
      ]);
      
      let totalProjects = 0;
      let totalTasks = 0;
      
      hierarchy.forEach((client: any) => {
        totalProjects += client.projects.length;
        client.projects.forEach((project: any) => {
          totalTasks += project.tasks.length;
        });
      });

      // Calculate active projects (projects with sessions in last 30 days)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const recentProjects = new Set();
      allSessions.forEach((session: any) => {
        if (session.createdAt > thirtyDaysAgo) {
          recentProjects.add(session.project);
        }
      });

      return {
        totalClients: clients.length,
        totalProjects,
        totalTasks,
        activeProjects: recentProjects.size,
        recentSessions: allSessions.filter((s: any) => s.createdAt > thirtyDaysAgo).length
      };
    },
  });

  // Fetch data for Quick Add dropdowns
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => window.electronAPI.database.getAllClients(),
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ['all-projects'],
    queryFn: async () => {
      const allProjects: any[] = [];
      for (const client of clients) {
        const projects = await window.electronAPI.database.getProjectsByClient(client.id);
        allProjects.push(...projects);
      }
      return allProjects;
    },
    enabled: clients.length > 0,
  });

  // Quick Add mutations
  const quickAddMutation = useMutation({
    mutationFn: async ({ type, name, parentId }: { type: 'client' | 'project' | 'task'; name: string; parentId?: number }) => {
      switch (type) {
        case 'client':
          return await window.electronAPI.database.insertClient(name);
        case 'project':
          if (!parentId) throw new Error('Client ID required for project');
          return await window.electronAPI.database.insertProject(name, parentId);
        case 'task':
          if (!parentId) throw new Error('Project ID required for task');
          return await window.electronAPI.database.insertTask(name, parentId);
        default:
          throw new Error('Invalid type');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-stats'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['all-projects'] });
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
      setQuickAddOpen(false);
      setQuickAddName('');
      setQuickAddParent('');
      toast.success(`${variables.type.charAt(0).toUpperCase() + variables.type.slice(1)} created successfully`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create item');
    },
  });

  const handleQuickAdd = () => {
    if (!quickAddName.trim()) {
      toast.error('Name is required');
      return;
    }
    
    if (quickAddType !== 'client' && !quickAddParent) {
      toast.error(`Please select a ${quickAddType === 'project' ? 'client' : 'project'}`);
      return;
    }

    quickAddMutation.mutate({
      type: quickAddType,
      name: quickAddName.trim(),
      parentId: quickAddParent ? parseInt(quickAddParent) : undefined
    });
  };

  const handleExportXLSX = async () => {
    try {
      const data = await window.electronAPI.database.exportToXLSX();
      console.log('XLSX Export Data:', data);
      toast.success('Export data prepared - check console for now');
      // TODO: Implement actual file download with SheetJS or similar
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed');
    }
  };

  // Permission check
  if (!hasPermission('manage_projects')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center space-y-4 p-6">
            <UserX className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h2 className="text-lg font-semibold">Access Denied</h2>
              <p className="text-sm text-muted-foreground">
                You don't have permission to manage projects
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Project Management</h1>
          <p className="text-muted-foreground">
            Manage clients, projects, tasks and user permissions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportXLSX}>
            <Download className="mr-2 h-4 w-4" />
            Export XLSX
          </Button>
          <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Zap className="mr-2 h-4 w-4" />
                Quick Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Quick Add</DialogTitle>
                <DialogDescription>
                  Rapidly create a new client, project, or task
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <Select value={quickAddType} onValueChange={(value: 'client' | 'project' | 'task') => {
                    setQuickAddType(value);
                    setQuickAddParent('');
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {quickAddType === 'project' && (
                  <div>
                    <label className="text-sm font-medium">Client</label>
                    <Select value={quickAddParent} onValueChange={setQuickAddParent}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map(client => (
                          <SelectItem key={client.id} value={client.id.toString()}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {quickAddType === 'task' && (
                  <div>
                    <label className="text-sm font-medium">Project</label>
                    <Select value={quickAddParent} onValueChange={setQuickAddParent}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {allProjects.map(project => (
                          <SelectItem key={project.id} value={project.id.toString()}>
                            {project.client_name} → {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    placeholder={`${quickAddType.charAt(0).toUpperCase() + quickAddType.slice(1)} name`}
                    value={quickAddName}
                    onChange={(e) => setQuickAddName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleQuickAdd();
                      }
                    }}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setQuickAddOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleQuickAdd}
                  disabled={quickAddMutation.isPending || !quickAddName.trim() || 
                    (quickAddType !== 'client' && !quickAddParent)}
                >
                  {quickAddMutation.isPending ? 'Creating...' : `Create ${quickAddType.charAt(0).toUpperCase() + quickAddType.slice(1)}`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : stats?.totalClients || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Client organizations
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : stats?.totalProjects || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all clients
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : stats?.totalTasks || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Available for tracking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : stats?.activeProjects || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              With recent activity
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Manage Hierarchy</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="clients" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Clients
              </TabsTrigger>
              <TabsTrigger value="projects" className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Projects
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                Tasks
              </TabsTrigger>
              <TabsTrigger value="permissions" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Permissions
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="clients" className="space-y-4">
              <ClientsTab />
            </TabsContent>
            
            <TabsContent value="projects" className="space-y-4">
              <ProjectsTab />
            </TabsContent>
            
            <TabsContent value="tasks" className="space-y-4">
              <TasksTab />
            </TabsContent>
            
            <TabsContent value="permissions" className="space-y-4">
              <UserProjectPermissionMatrix />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}