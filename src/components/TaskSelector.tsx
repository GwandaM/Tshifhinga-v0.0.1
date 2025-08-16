import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, X, ChevronRight, Search } from "lucide-react";
import { TaskRef } from "@/features/tracker/TimerContext";
import { useAuth } from "@/contexts/AuthContext";

interface TaskSelectorProps {
  onTaskSelect: (task: TaskRef) => void;
  onCancel: () => void;
}

interface HierarchyItem {
  id: number;
  name: string;
  client_id?: number;
  project_id?: number;
}

type SelectionStep = 'client' | 'project' | 'task';

export const TaskSelector: React.FC<TaskSelectorProps> = ({ onTaskSelect, onCancel }) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<SelectionStep>('client');
  const [selectedClient, setSelectedClient] = useState<HierarchyItem | null>(null);
  const [selectedProject, setSelectedProject] = useState<HierarchyItem | null>(null);
  
  const [clients, setClients] = useState<HierarchyItem[]>([]);
  const [projects, setProjects] = useState<HierarchyItem[]>([]);
  const [tasks, setTasks] = useState<HierarchyItem[]>([]);
  const [allTasks, setAllTasks] = useState<TaskRef[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<TaskRef[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    loadClients();
    loadAllTasks(); // Load all tasks for search functionality
  }, []);

  useEffect(() => {
    if (selectedClient) {
      loadProjects(selectedClient.id);
    }
  }, [selectedClient]);

  useEffect(() => {
    if (selectedProject) {
      loadTasks(selectedProject.id);
    }
  }, [selectedProject]);

  useEffect(() => {
    // Handle search functionality
    if (searchTerm.trim() === "") {
      setIsSearching(false);
      setSearchResults([]);
    } else {
      setIsSearching(true);
      const filtered = allTasks.filter(task => 
        task.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.task.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setSearchResults(filtered);
    }
  }, [searchTerm, allTasks]);

  const loadClients = async () => {
    try {
      setLoading(true);
      console.log('TaskSelector: Loading clients...');
      const clientsData = await (window as any).electronAPI?.database.getAllClients();
      console.log('TaskSelector: Clients loaded:', clientsData);
      
      // If no clients exist, create default project structure
      if (clientsData.length === 0) {
        console.log('TaskSelector: No clients found, creating default project structure...');
        try {
          await (window as any).electronAPI?.database.createDefaultProjectStructure();
          // Reload clients after creating default structure
          const newClientsData = await (window as any).electronAPI?.database.getAllClients();
          console.log('TaskSelector: Default structure created, new clients:', newClientsData);
          setClients(newClientsData);
        } catch (createError) {
          console.error('TaskSelector: Error creating default structure:', createError);
          setClients(clientsData); // Set empty array
        }
      } else {
        setClients(clientsData);
      }
    } catch (error) {
      console.error('TaskSelector: Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async (clientId: number) => {
    try {
      const projectsData = await (window as any).electronAPI?.database.getProjectsByClient(clientId);
      setProjects(projectsData);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadTasks = async (projectId: number) => {
    try {
      const tasksData = await (window as any).electronAPI?.database.getTasksByProject(projectId);
      setTasks(tasksData);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const loadAllTasks = async () => {
    try {
      console.log('TaskSelector: Loading all tasks for search...');
      // Load all hierarchy data for search using electronAPI
      const electronAPI = (window as any).electronAPI;
      
      const [clientsData, projectsData, tasksData] = await Promise.all([
        electronAPI?.database.getAllClients(),
        electronAPI?.database.getAllClients().then(clients => 
          Promise.all(clients.map(client => electronAPI?.database.getProjectsByClient(client.id)))
        ).then(projectArrays => projectArrays.flat()),
        electronAPI?.database.getAllClients().then(clients => 
          Promise.all(clients.map(client => 
            electronAPI?.database.getProjectsByClient(client.id).then(projects =>
              Promise.all(projects.map(project => electronAPI?.database.getTasksByProject(project.id)))
            )
          ))
        ).then(taskArrays => taskArrays.flat().flat())
      ]);

      console.log('TaskSelector: All data loaded - clients:', clientsData.length, 'projects:', projectsData.length, 'tasks:', tasksData.length);

      // Create flat task list with full hierarchy names for search
      const flatTasks: TaskRef[] = [];
      
      for (const client of clientsData) {
        const clientProjects = projectsData.filter(p => p.client_id === client.id);
        
        for (const project of clientProjects) {
          const projectTasks = tasksData.filter(t => t.project_id === project.id);
          
          for (const task of projectTasks) {
            flatTasks.push({
              client: client.name,
              project: project.name,
              task: task.name
            });
          }
        }
      }

      console.log('TaskSelector: Created flat tasks for search:', flatTasks.length);
      setAllTasks(flatTasks);
    } catch (error) {
      console.error('TaskSelector: Error loading all tasks:', error);
    }
  };

  const handleClientSelect = (client: HierarchyItem) => {
    setSelectedClient(client);
    setSelectedProject(null);
    setCurrentStep('project');
  };

  const handleProjectSelect = (project: HierarchyItem) => {
    setSelectedProject(project);
    setCurrentStep('task');
  };

  const handleTaskSelect = (task: HierarchyItem) => {
    if (selectedClient && selectedProject) {
      const taskRef: TaskRef = {
        client: selectedClient.name,
        project: selectedProject.name,
        task: task.name
      };
      onTaskSelect(taskRef);
    }
  };

  const handleSearchTaskSelect = (task: TaskRef) => {
    onTaskSelect(task);
  };

  const handleBack = () => {
    if (currentStep === 'task') {
      setCurrentStep('project');
      setSelectedProject(null);
    } else if (currentStep === 'project') {
      setCurrentStep('client');
      setSelectedClient(null);
      setSelectedProject(null);
    }
  };

  const getTitle = () => {
    switch (currentStep) {
      case 'client': return 'Select Client';
      case 'project': return 'Select Project';
      case 'task': return 'Select Task';
    }
  };

  const getBreadcrumb = () => {
    const parts = [];
    if (selectedClient) parts.push(selectedClient.name);
    if (selectedProject) parts.push(selectedProject.name);
    return parts.join(' → ');
  };

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center text-sm">Loading...</div>
      </div>
    );
  }

  const renderList = () => {
    // If searching, show search results
    if (isSearching) {
      return (
        <div className="flex-1 overflow-y-auto">
          {searchResults.length > 0 ? (
            <div>
              {searchResults.map((task, index) => (
                <button
                  key={`${task.client}-${task.project}-${task.task}-${index}`}
                  onClick={() => handleSearchTaskSelect(task)}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b border-border/50 last:border-b-0 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{task.task}</div>
                    <div className="text-xs text-muted-foreground">
                      {task.client} → {task.project}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No tasks found matching "{searchTerm}"
            </div>
          )}
        </div>
      );
    }

    // Normal hierarchical navigation
    let items: HierarchyItem[] = [];
    let onItemSelect: (item: HierarchyItem) => void = () => {};

    switch (currentStep) {
      case 'client':
        items = clients;
        onItemSelect = handleClientSelect;
        break;
      case 'project':
        items = projects;
        onItemSelect = handleProjectSelect;
        break;
      case 'task':
        items = tasks;
        onItemSelect = handleTaskSelect;
        break;
    }

    return (
      <div className="flex-1 overflow-y-auto">
        {items.length > 0 ? (
          <div>
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => onItemSelect(item)}
                className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b border-border/50 last:border-b-0 transition-colors flex items-center justify-between"
              >
                <span className="text-sm truncate">{item.name}</span>
                {currentStep !== 'task' && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
              </button>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No {currentStep}s available
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      <div className="p-3 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentStep !== 'client' && !isSearching && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="h-6 w-6 p-0"
              >
                <ArrowLeft className="h-3 w-3" />
              </Button>
            )}
            <div>
              <div className="text-sm font-medium">
                {isSearching ? 'Search Results' : getTitle()}
              </div>
              {getBreadcrumb() && !isSearching && (
                <div className="text-xs text-muted-foreground truncate">{getBreadcrumb()}</div>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search clients, projects, tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-7 h-7 text-xs"
          />
        </div>
      </div>

      {renderList()}

      <div className="p-3 border-t">
        <Button
          variant="outline"
          onClick={onCancel}
          className="w-full h-8 text-xs"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};