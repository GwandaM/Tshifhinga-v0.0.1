import React, { useState, useEffect } from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { electronDB } from "@/lib/electron-database";
import type { TaskRef } from "../TimerContext";

export interface ClientData {
  name: string;
  projects: { name: string; tasks: string[] }[];
}

// Initial seed data - can be expanded by users
const INITIAL_SAMPLE: ClientData[] = [
  {
    name: "Acme Corp",
    projects: [
      { name: "Website Redesign", tasks: ["Development", "Testing", "Client Meetings", "Documentation"] },
      { name: "Mobile App", tasks: ["Planning", "Development", "QA", "Launch"] },
    ],
  },
  {
    name: "Globex Inc",
    projects: [
      { name: "Internal Tools", tasks: ["UX", "Implementation", "Review"] },
      { name: "Marketing Site", tasks: ["Content", "Design", "Build"] },
    ],
  },
  {
    name: "Company",
    projects: [
      { name: "Non-Billable", tasks: ["Admin"] },
    ],
  },
];

// Legacy localStorage key for migration
const HIERARCHY_STORAGE_KEY = "tt_hierarchy_data_v1";

// Check if running in Electron environment
function isElectron(): boolean {
  return !!(window as any).electronAPI;
}

// Load hierarchy data from database or localStorage fallback
async function loadHierarchyData(): Promise<ClientData[]> {
  try {
    if (isElectron()) {
      // Load from database
      const hierarchy = await electronDB.getHierarchy();
      return hierarchy;
    } else {
      // Fallback to localStorage for web
      const stored = localStorage.getItem(HIERARCHY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ClientData[];
        // Ensure Company/Non-Billable/Admin always exists
        const hasCompany = parsed.some(c => c.name === "Company");
        if (!hasCompany) {
          parsed.push({
            name: "Company",
            projects: [{ name: "Non-Billable", tasks: ["Admin"] }]
          });
        }
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to load hierarchy data:', error);
  }
  return INITIAL_SAMPLE;
}

// Save hierarchy data to localStorage (web fallback only)
function saveHierarchyDataToLocalStorage(data: ClientData[]) {
  try {
    localStorage.setItem(HIERARCHY_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save hierarchy data to localStorage:', error);
  }
}

// Helper functions to manage dynamic data structure
function findClientData(clients: ClientData[], clientName?: string): ClientData | undefined {
  return clients.find((c) => c.name === clientName);
}

function findProjects(clients: ClientData[], clientName?: string): string[] {
  return findClientData(clients, clientName)?.projects.map(p => p.name) ?? [];
}

function findTasks(clients: ClientData[], clientName?: string, projectName?: string): string[] {
  const clientData = findClientData(clients, clientName);
  return clientData?.projects.find(p => p.name === projectName)?.tasks ?? [];
}

export const HierarchySelector: React.FC<{
  value?: TaskRef;
  onChange: (t?: TaskRef) => void;
  className?: string;
}> = ({ value, onChange, className }) => {
  // State to manage dynamic client/project/task data
  const [clientsData, setClientsData] = useState<ClientData[]>(INITIAL_SAMPLE);
  const [loading, setLoading] = useState(true);

  // Load hierarchy data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Check for localStorage migration first
        if (isElectron()) {
          const stored = localStorage.getItem(HIERARCHY_STORAGE_KEY);
          if (stored) {
            try {
              const localStorageData = JSON.parse(stored);
              console.log('Found localStorage hierarchy data, migrating to database...');
              await electronDB.migrateHierarchyFromLocalStorage(localStorageData);
              // Remove from localStorage after successful migration
              localStorage.removeItem(HIERARCHY_STORAGE_KEY);
              console.log('Hierarchy migration completed, localStorage data removed');
            } catch (migrationError) {
              console.error('Failed to migrate hierarchy data:', migrationError);
              // Don't fail completely, continue with loading
            }
          }
        }
        
        const data = await loadHierarchyData();
        setClientsData(data);
      } catch (error) {
        console.error('Failed to load hierarchy data:', error);
        // Always provide fallback data to prevent crashes
        setClientsData(INITIAL_SAMPLE);
      } finally {
        setLoading(false);
      }
    };

    // Wrap in setTimeout to prevent blocking the initial render
    setTimeout(loadData, 0);
  }, []);
  
  // Get current options for each level
  const clientNames = clientsData.map(c => c.name);
  const projectNames = findProjects(clientsData, value?.client);
  const taskNames = findTasks(clientsData, value?.client, value?.project);

  // Add new client
  const handleAddClient = async (newClient: string) => {
    try {
      if (isElectron()) {
        // Add to database
        await electronDB.insertClient(newClient);
        // Reload hierarchy data
        const updatedData = await loadHierarchyData();
        setClientsData(updatedData);
      } else {
        // Fallback to local state for web
        const newData = [
          ...clientsData,
          { name: newClient, projects: [] }
        ];
        setClientsData(newData);
        saveHierarchyDataToLocalStorage(newData);
      }
    } catch (error) {
      console.error('Failed to add client:', error);
      // Don't crash, just add to local state as fallback
      const newData = [
        ...clientsData,
        { name: newClient, projects: [] }
      ];
      setClientsData(newData);
      if (!isElectron()) {
        saveHierarchyDataToLocalStorage(newData);
      }
    }
  };

  // Add new project to current client
  const handleAddProject = async (newProject: string) => {
    if (!value?.client) return;
    
    try {
      if (isElectron()) {
        // Get client ID and add project to database
        const clientId = await electronDB.insertClient(value.client);
        await electronDB.insertProject(newProject, clientId);
        // Reload hierarchy data
        const updatedData = await loadHierarchyData();
        setClientsData(updatedData);
      } else {
        // Fallback to local state for web
        const newData = clientsData.map(client => 
          client.name === value.client 
            ? { ...client, projects: [...client.projects, { name: newProject, tasks: [] }] }
            : client
        );
        setClientsData(newData);
        saveHierarchyDataToLocalStorage(newData);
      }
    } catch (error) {
      console.error('Failed to add project:', error);
      // Don't crash, add to local state as fallback
      const newData = clientsData.map(client => 
        client.name === value.client 
          ? { ...client, projects: [...client.projects, { name: newProject, tasks: [] }] }
          : client
      );
      setClientsData(newData);
      if (!isElectron()) {
        saveHierarchyDataToLocalStorage(newData);
      }
    }
  };

  // Add new task to current client/project
  const handleAddTask = async (newTask: string) => {
    if (!value?.client || !value?.project) return;
    
    try {
      if (isElectron()) {
        // Get project ID and add task to database
        const clientId = await electronDB.insertClient(value.client);
        const projectId = await electronDB.insertProject(value.project, clientId);
        await electronDB.insertTask(newTask, projectId);
        // Reload hierarchy data
        const updatedData = await loadHierarchyData();
        setClientsData(updatedData);
      } else {
        // Fallback to local state for web
        const newData = clientsData.map(client => 
          client.name === value.client
            ? {
                ...client,
                projects: client.projects.map(project =>
                  project.name === value.project
                    ? { ...project, tasks: [...project.tasks, newTask] }
                    : project
                )
              }
            : client
        );
        setClientsData(newData);
        saveHierarchyDataToLocalStorage(newData);
      }
    } catch (error) {
      console.error('Failed to add task:', error);
      // Don't crash, add to local state as fallback
      const newData = clientsData.map(client => 
        client.name === value.client
          ? {
              ...client,
              projects: client.projects.map(project =>
                project.name === value.project
                  ? { ...project, tasks: [...project.tasks, newTask] }
                  : project
              )
            }
          : client
      );
      setClientsData(newData);
      if (!isElectron()) {
        saveHierarchyDataToLocalStorage(newData);
      }
    }
  };

  // Handle client selection
  const handleClientChange = (client: string) => {
    onChange(client ? { client, project: "", task: "" } : undefined);
  };

  // Handle project selection
  const handleProjectChange = (project: string) => {
    if (value?.client) {
      onChange({ client: value.client, project, task: "" });
    }
  };

  // Handle task selection
  const handleTaskChange = (task: string) => {
    if (value?.client && value?.project) {
      onChange({ client: value.client, project: value.project, task });
    }
  };

  return (
    <div className={cn("grid grid-cols-1 gap-3 md:grid-cols-3", className)}>
      <SearchableSelect
        items={clientNames}
        value={value?.client}
        onValueChange={handleClientChange}
        onAddItem={handleAddClient}
        placeholder={loading ? "Loading clients..." : "Select client"}
        label="Client"
        disabled={loading}
      />

      <SearchableSelect
        items={projectNames}
        value={value?.project}
        onValueChange={handleProjectChange}
        onAddItem={handleAddProject}
        placeholder={loading ? "Loading..." : "Select project"}
        label="Project"
        disabled={loading || !value?.client}
      />

      <SearchableSelect
        items={taskNames}
        value={value?.task}
        onValueChange={handleTaskChange}
        onAddItem={handleAddTask}
        placeholder={loading ? "Loading..." : "Select task"}
        label="Task"
        disabled={loading || !value?.client || !value?.project}
      />
    </div>
  );
};
