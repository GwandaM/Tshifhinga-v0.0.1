import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../../../components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Badge } from '../../../components/ui/badge';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  CheckSquare,
  Calendar,
  Building2,
  FolderOpen,
  Copy,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';

interface Task {
  id: number;
  name: string;
  project_id: number;
  project_name: string;
  client_name: string;
  created_at: number;
}

interface Project {
  id: number;
  name: string;
  client_id: number;
  client_name: string;
  created_at: number;
  task_count: number;
  user_count: number;
}

interface Client {
  id: number;
  name: string;
  created_at: number;
  project_count: number;
  task_count: number;
}

export function TasksTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskProjectId, setNewTaskProjectId] = useState('');
  const [editTaskName, setEditTaskName] = useState('');
  const [editTaskProjectId, setEditTaskProjectId] = useState('');
  const [copyTargetProjectId, setCopyTargetProjectId] = useState('');

  // Fetch clients for filtering
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const response = await window.electronAPI.database.getAllClients();
      return response as Client[];
    },
  });

  // Fetch all projects from all clients
  const { data: allProjects = [] } = useQuery({
    queryKey: ['all-projects'],
    queryFn: async () => {
      const allProjects: Project[] = [];
      for (const client of clients) {
        const projects = await window.electronAPI.database.getProjectsByClient(client.id);
        allProjects.push(...projects);
      }
      return allProjects;
    },
    enabled: clients.length > 0,
  });

  // Fetch all tasks from all projects
  const { data: allTasks = [], isLoading, error } = useQuery({
    queryKey: ['all-tasks'],
    queryFn: async () => {
      const allTasks: Task[] = [];
      for (const project of allProjects) {
        const tasks = await window.electronAPI.database.getTasksByProject(project.id);
        allTasks.push(...tasks);
      }
      return allTasks;
    },
    enabled: allProjects.length > 0,
  });

  // Add task mutation
  const addTaskMutation = useMutation({
    mutationFn: async ({ name, projectId }: { name: string; projectId: number }) => {
      return await window.electronAPI.database.insertTask(name, projectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-stats'] });
      setAddDialogOpen(false);
      setNewTaskName('');
      setNewTaskProjectId('');
      toast.success('Task added successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add task');
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, name, projectId }: { id: number; name: string; projectId: number }) => {
      return await window.electronAPI.database.updateTask(id, name, projectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
      setEditDialogOpen(false);
      setSelectedTask(null);
      setEditTaskName('');
      setEditTaskProjectId('');
      toast.success('Task updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update task');
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      return await window.electronAPI.database.deleteTask(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-stats'] });
      setDeleteDialogOpen(false);
      setSelectedTask(null);
      toast.success('Task deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete task');
    },
  });

  // Copy task mutation
  const copyTaskMutation = useMutation({
    mutationFn: async ({ sourceTaskId, targetProjectId }: { sourceTaskId: number; targetProjectId: number }) => {
      return await window.electronAPI.database.copyTask(sourceTaskId, targetProjectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-stats'] });
      setCopyDialogOpen(false);
      setSelectedTask(null);
      setCopyTargetProjectId('');
      toast.success('Task copied successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to copy task');
    },
  });

  // Filter tasks based on search and filters
  const filteredTasks = allTasks.filter(task => {
    const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.client_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesProject = projectFilter === 'all' || task.project_id.toString() === projectFilter;
    
    let matchesClient = true;
    if (clientFilter !== 'all') {
      const project = allProjects.find(p => p.id === task.project_id);
      matchesClient = project?.client_id.toString() === clientFilter;
    }
    
    return matchesSearch && matchesProject && matchesClient;
  });

  // Filter projects based on client filter for dropdowns
  const filteredProjects = clientFilter === 'all' 
    ? allProjects 
    : allProjects.filter(p => p.client_id.toString() === clientFilter);

  const handleAddTask = () => {
    if (!newTaskName.trim()) {
      toast.error('Task name is required');
      return;
    }
    if (!newTaskProjectId) {
      toast.error('Please select a project');
      return;
    }
    addTaskMutation.mutate({ 
      name: newTaskName.trim(), 
      projectId: parseInt(newTaskProjectId) 
    });
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setEditTaskName(task.name);
    setEditTaskProjectId(task.project_id.toString());
    setEditDialogOpen(true);
  };

  const handleUpdateTask = () => {
    if (!editTaskName.trim() || !selectedTask) {
      toast.error('Task name is required');
      return;
    }
    if (!editTaskProjectId) {
      toast.error('Please select a project');
      return;
    }
    updateTaskMutation.mutate({ 
      id: selectedTask.id, 
      name: editTaskName.trim(),
      projectId: parseInt(editTaskProjectId)
    });
  };

  const handleDeleteTask = (task: Task) => {
    setSelectedTask(task);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteTask = () => {
    if (selectedTask) {
      deleteTaskMutation.mutate(selectedTask.id);
    }
  };

  const handleCopyTask = (task: Task) => {
    setSelectedTask(task);
    setCopyTargetProjectId('');
    setCopyDialogOpen(true);
  };

  const confirmCopyTask = () => {
    if (selectedTask && copyTargetProjectId) {
      copyTaskMutation.mutate({
        sourceTaskId: selectedTask.id,
        targetProjectId: parseInt(copyTargetProjectId)
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">Error loading tasks</p>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['all-tasks'] })}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search, Filters and Add */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map(client => (
                <SelectItem key={client.id} value={client.id.toString()}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {filteredProjects.map(project => (
                <SelectItem key={project.id} value={project.id.toString()}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Task</DialogTitle>
              <DialogDescription>
                Create a new task under a project for time tracking.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Project</label>
                <Select value={newTaskProjectId} onValueChange={setNewTaskProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
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
              <div>
                <label className="text-sm font-medium">Task Name</label>
                <Input
                  placeholder="Task name"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddTask}
                disabled={addTaskMutation.isPending}
              >
                {addTaskMutation.isPending ? 'Adding...' : 'Add Task'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Tasks ({filteredTasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTasks.length === 0 ? (
            <div className="text-center py-8">
              <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || projectFilter !== 'all' || clientFilter !== 'all' 
                  ? 'No tasks found matching your filters' 
                  : 'No tasks found'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        <FolderOpen className="h-3 w-3" />
                        {task.project_name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        <Building2 className="h-3 w-3" />
                        {task.client_name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(task.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyTask(task)}
                          title="Copy to another project"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTask(task)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTask(task)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Task Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>
              Update the task details. You can move tasks between projects.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Project</label>
              <Select value={editTaskProjectId} onValueChange={setEditTaskProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
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
            <div>
              <label className="text-sm font-medium">Task Name</label>
              <Input
                placeholder="Task name"
                value={editTaskName}
                onChange={(e) => setEditTaskName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUpdateTask()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateTask}
              disabled={updateTaskMutation.isPending}
            >
              {updateTaskMutation.isPending ? 'Updating...' : 'Update Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy Task Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Task</DialogTitle>
            <DialogDescription>
              Copy "{selectedTask?.name}" to another project. The task will be duplicated with the same name.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Target Project</label>
            <Select value={copyTargetProjectId} onValueChange={setCopyTargetProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select target project" />
              </SelectTrigger>
              <SelectContent>
                {allProjects
                  .filter(p => p.id !== selectedTask?.project_id) // Exclude current project
                  .map(project => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.client_name} → {project.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmCopyTask}
              disabled={copyTaskMutation.isPending || !copyTargetProjectId}
            >
              {copyTaskMutation.isPending ? 'Copying...' : 'Copy Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Task Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedTask?.name}" from "{selectedTask?.project_name}"? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteTask}
              disabled={deleteTaskMutation.isPending}
            >
              {deleteTaskMutation.isPending ? 'Deleting...' : 'Delete Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}