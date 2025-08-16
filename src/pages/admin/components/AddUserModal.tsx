import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { ConfigurationSelect } from '../../../components/ui/configuration-select';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Loader2, User, Mail, Lock, Shield, Building, MapPin, Briefcase, DollarSign, Percent, Target } from 'lucide-react';
import { useToast } from '../../../components/ui/use-toast';

interface AddUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated: () => void;
}

export function AddUserModal({ open, onOpenChange, onUserCreated }: AddUserModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [teams, setTeams] = useState<Array<{code: string, name: string}>>([]);
  const [regions, setRegions] = useState<Array<{code: string, name: string}>>([]);
  const [jobLevels, setJobLevels] = useState<Array<{code: string, name: string}>>([]);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user' as 'admin' | 'user',
    name: '',
    surname: '',
    team: '',
    region: '',
    jobLevel: '',
    billableRate: '',
    discountPercentage: '0',
    targetUtilization: '85',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load configuration data
  useEffect(() => {
    const loadConfigData = async () => {
      try {
        const [teamsData, regionsData, jobLevelsData] = await Promise.all([
          window.electronAPI.database.getTeams(),
          window.electronAPI.database.getRegions(),
          window.electronAPI.database.getJobLevels()
        ]);
        setTeams(teamsData);
        setRegions(regionsData);
        setJobLevels(jobLevelsData);
      } catch (error) {
        console.error('Error loading configuration data:', error);
      }
    };
    
    if (open) {
      loadConfigData();
    }
  }, [open]);

  // Handlers for creating new configuration items
  const handleCreateTeam = async (name: string, description?: string): Promise<string> => {
    try {
      const code = await window.electronAPI.database.createTeam(name, description);
      // Refresh teams list
      const updatedTeams = await window.electronAPI.database.getTeams();
      setTeams(updatedTeams);
      toast({
        title: "Team created",
        description: `${name} has been added to the teams list`,
      });
      return code;
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to create team: ${error.message}`,
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleCreateRegion = async (name: string): Promise<string> => {
    try {
      const code = await window.electronAPI.database.createRegion(name);
      // Refresh regions list
      const updatedRegions = await window.electronAPI.database.getRegions();
      setRegions(updatedRegions);
      toast({
        title: "Region created",
        description: `${name} has been added to the regions list`,
      });
      return code;
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to create region: ${error.message}`,
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleCreateJobLevel = async (name: string): Promise<string> => {
    try {
      const code = await window.electronAPI.database.createJobLevel(name);
      // Refresh job levels list
      const updatedJobLevels = await window.electronAPI.database.getJobLevels();
      setJobLevels(updatedJobLevels);
      toast({
        title: "Job level created",
        description: `${name} has been added to the job levels list`,
      });
      return code;
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to create job level: ${error.message}`,
        variant: "destructive",
      });
      throw error;
    }
  };

  // Auto-populate billable rate when job level changes
  useEffect(() => {
    if (formData.jobLevel) {
      const fetchBillableRate = async () => {
        try {
          const rate = await window.electronAPI.database.getBillableRateByJobLevel(formData.jobLevel);
          if (rate) {
            setFormData(prev => ({ ...prev, billableRate: rate.toString() }));
          }
        } catch (error) {
          console.error('Error fetching billable rate:', error);
        }
      };
      fetchBillableRate();
    }
  }, [formData.jobLevel]);

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'user',
      name: '',
      surname: '',
      team: '',
      region: '',
      jobLevel: '',
      billableRate: '',
      discountPercentage: '0',
      targetUtilization: '85',
    });
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm the password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Role validation
    if (!formData.role) {
      newErrors.role = 'Please select a role';
    }

    // Billable rate validation (if provided)
    if (formData.billableRate && isNaN(Number(formData.billableRate))) {
      newErrors.billableRate = 'Billable rate must be a valid number';
    }

    // Discount percentage validation
    if (formData.discountPercentage && (isNaN(Number(formData.discountPercentage)) || Number(formData.discountPercentage) < 0 || Number(formData.discountPercentage) > 100)) {
      newErrors.discountPercentage = 'Discount must be between 0 and 100';
    }

    // Target utilization validation
    if (formData.targetUtilization && (isNaN(Number(formData.targetUtilization)) || Number(formData.targetUtilization) < 0 || Number(formData.targetUtilization) > 100)) {
      newErrors.targetUtilization = 'Target utilization must be between 0 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const additionalData = {
        name: formData.name || undefined,
        surname: formData.surname || undefined,
        team: formData.team || undefined,
        region: formData.region || undefined,
        jobLevel: formData.jobLevel || undefined,
        billableRate: formData.billableRate ? Number(formData.billableRate) : undefined,
        discountPercentage: Number(formData.discountPercentage),
        targetUtilization: Number(formData.targetUtilization),
      };

      const result = await window.electronAPI.auth.register(
        formData.username,
        formData.email,
        formData.password,
        formData.role,
        additionalData
      );

      if (result.success) {
        toast({
          title: "User created successfully",
          description: `${formData.username} has been added to the system`,
        });
        
        resetForm();
        onUserCreated();
        onOpenChange(false);
      } else {
        setErrors({ general: result.error || 'Failed to create user' });
      }
    } catch (error) {
      console.error('Error creating user:', error);
      setErrors({ general: 'Failed to create user. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isLoading) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account with login credentials and role assignment.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.general && (
            <Alert variant="destructive">
              <AlertDescription>{errors.general}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="username">
              <User className="inline w-4 h-4 mr-1" />
              Username
            </Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter username"
              value={formData.username}
              onChange={(e) => handleChange('username', e.target.value)}
              disabled={isLoading}
              className={errors.username ? 'border-red-500' : ''}
            />
            {errors.username && (
              <p className="text-sm text-red-600">{errors.username}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              <Mail className="inline w-4 h-4 mr-1" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter email address"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              disabled={isLoading}
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              <Lock className="inline w-4 h-4 mr-1" />
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter password"
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              disabled={isLoading}
              className={errors.password ? 'border-red-500' : ''}
            />
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm password"
              value={formData.confirmPassword}
              onChange={(e) => handleChange('confirmPassword', e.target.value)}
              disabled={isLoading}
              className={errors.confirmPassword ? 'border-red-500' : ''}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-red-600">{errors.confirmPassword}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">
              <Shield className="inline w-4 h-4 mr-1" />
              Role
            </Label>
            <Select
              value={formData.role}
              onValueChange={(value: 'admin' | 'user') => handleChange('role', value)}
              disabled={isLoading}
            >
              <SelectTrigger className={errors.role ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select user role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-red-600">{errors.role}</p>
            )}
            <p className="text-sm text-muted-foreground">
              {formData.role === 'admin' 
                ? 'Administrators have full access to all features and can manage other users'
                : 'Users can track time on projects they have been assigned to'
              }
            </p>
          </div>

          {/* Enhanced User Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                <User className="inline w-4 h-4 mr-1" />
                First Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter first name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                disabled={isLoading}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="surname">
                <User className="inline w-4 h-4 mr-1" />
                Last Name
              </Label>
              <Input
                id="surname"
                type="text"
                placeholder="Enter last name"
                value={formData.surname}
                onChange={(e) => handleChange('surname', e.target.value)}
                disabled={isLoading}
                className={errors.surname ? 'border-red-500' : ''}
              />
              {errors.surname && (
                <p className="text-sm text-red-600">{errors.surname}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="team">
                <Building className="inline w-4 h-4 mr-1" />
                Team
              </Label>
              <ConfigurationSelect
                items={teams}
                value={formData.team}
                onValueChange={(value) => handleChange('team', value)}
                onAddItem={(name, description) => handleCreateTeam(name, description)}
                placeholder="Select team"
                label="team"
                disabled={isLoading}
                allowEmpty={true}
                emptyLabel="No team"
                className={errors.team ? 'border-red-500' : ''}
              />
              {errors.team && (
                <p className="text-sm text-red-600">{errors.team}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">
                <MapPin className="inline w-4 h-4 mr-1" />
                Region
              </Label>
              <ConfigurationSelect
                items={regions}
                value={formData.region}
                onValueChange={(value) => handleChange('region', value)}
                onAddItem={handleCreateRegion}
                placeholder="Select region"
                label="region"
                disabled={isLoading}
                allowEmpty={true}
                emptyLabel="No region"
                className={errors.region ? 'border-red-500' : ''}
              />
              {errors.region && (
                <p className="text-sm text-red-600">{errors.region}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jobLevel">
              <Briefcase className="inline w-4 h-4 mr-1" />
              Job Level
            </Label>
            <ConfigurationSelect
              items={jobLevels}
              value={formData.jobLevel}
              onValueChange={(value) => handleChange('jobLevel', value)}
              onAddItem={handleCreateJobLevel}
              placeholder="Select job level"
              label="job level"
              disabled={isLoading}
              allowEmpty={true}
              emptyLabel="No job level"
              className={errors.jobLevel ? 'border-red-500' : ''}
            />
            {errors.jobLevel && (
              <p className="text-sm text-red-600">{errors.jobLevel}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Billable rate will be automatically populated based on job level
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="billableRate">
                <DollarSign className="inline w-4 h-4 mr-1" />
                Billable Rate (R/hour)
              </Label>
              <Input
                id="billableRate"
                type="number"
                placeholder="0"
                value={formData.billableRate}
                onChange={(e) => handleChange('billableRate', e.target.value)}
                disabled={isLoading}
                className={errors.billableRate ? 'border-red-500' : ''}
              />
              {errors.billableRate && (
                <p className="text-sm text-red-600">{errors.billableRate}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountPercentage">
                <Percent className="inline w-4 h-4 mr-1" />
                Discount (%)
              </Label>
              <Input
                id="discountPercentage"
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={formData.discountPercentage}
                onChange={(e) => handleChange('discountPercentage', e.target.value)}
                disabled={isLoading}
                className={errors.discountPercentage ? 'border-red-500' : ''}
              />
              {errors.discountPercentage && (
                <p className="text-sm text-red-600">{errors.discountPercentage}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetUtilization">
                <Target className="inline w-4 h-4 mr-1" />
                Target Utilization (%)
              </Label>
              <Input
                id="targetUtilization"
                type="number"
                min="0"
                max="100"
                placeholder="85"
                value={formData.targetUtilization}
                onChange={(e) => handleChange('targetUtilization', e.target.value)}
                disabled={isLoading}
                className={errors.targetUtilization ? 'border-red-500' : ''}
              />
              {errors.targetUtilization && (
                <p className="text-sm text-red-600">{errors.targetUtilization}</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create User'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}