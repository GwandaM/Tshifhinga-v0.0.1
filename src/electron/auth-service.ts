const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { DatabaseService } = require('./database');

interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'director';
  name?: string;
  surname?: string;
  team?: string;
  region?: string;
  jobLevel?: string;
  billableRate?: number;
  discountPercentage?: number;
  targetUtilization?: number;
}

interface LoginResponse {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
}

interface RegisterResponse {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

class AuthService {
  private db: any;
  private jwtSecret: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  private tokenExpiry: string = '24h';

  constructor() {
    this.db = new DatabaseService();
  }

  async init(): Promise<void> {
    await this.db.init();
    await this.createDefaultAdmin();
  }

  private async createDefaultAdmin(): Promise<void> {
    try {
      // Check if admin already exists
      const existingAdmin = await this.db.getUserByUsername('admin');
      if (existingAdmin) {
        return;
      }

      // Create default admin user
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await this.db.createUser('admin', 'admin@example.com', hashedPassword, 'admin');
      console.log('Default admin user created: username=admin, password=admin123');
    } catch (error) {
      console.error('Error creating default admin:', error);
    }
  }

  async register(
    username: string, 
    email: string, 
    password: string, 
    role: 'admin' | 'user' | 'director' = 'user',
    additionalData?: {
      name?: string;
      surname?: string;
      team?: string;
      region?: string;
      jobLevel?: string;
      billableRate?: number;
      discountPercentage?: number;
      targetUtilization?: number;
    }
  ): Promise<RegisterResponse> {
    try {
      // Validate input
      if (!username || !email || !password) {
        return { success: false, error: 'Username, email, and password are required' };
      }

      if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters long' };
      }

      // Check if user already exists
      const existingUser = await this.db.getUserByUsername(username);
      if (existingUser) {
        return { success: false, error: 'Username already exists' };
      }

      // Hash password and create user with enhanced data
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = await this.db.createUserEnhanced({
        username,
        email,
        passwordHash: hashedPassword,
        role,
        ...additionalData
      });

      const user: AuthUser = {
        id: userId,
        username,
        email,
        role,
        ...additionalData
      };

      // Create default project structure for new users
      try {
        await this.db.createDefaultProjectStructure();
        console.log('Default project structure created for new user:', username);
      } catch (structureError) {
        console.error('Failed to create default project structure:', structureError);
        // Don't fail registration if default structure creation fails
      }

      return { success: true, user };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message || 'Registration failed' };
    }
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      // Validate input
      if (!username || !password) {
        return { success: false, error: 'Username and password are required' };
      }

      // Get user from database
      const dbUser = await this.db.getUserByUsername(username);
      if (!dbUser) {
        return { success: false, error: 'Invalid username or password' };
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, dbUser.passwordHash);
      if (!passwordMatch) {
        return { success: false, error: 'Invalid username or password' };
      }

      // Create user object (without password hash)
      const user: AuthUser = {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        role: dbUser.role
      };

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        this.jwtSecret,
        { expiresIn: this.tokenExpiry }
      );

      return { success: true, user, token };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    }
  }

  async verifyToken(token: string): Promise<AuthUser | null> {
    try {
      const decoded: any = jwt.verify(token, this.jwtSecret);
      
      // Get fresh user data from database
      const dbUser = await this.db.getUserById(decoded.userId);
      if (!dbUser) {
        return null;
      }

      return {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        role: dbUser.role
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  }

  async getCurrentUser(token: string): Promise<AuthUser | null> {
    return this.verifyToken(token);
  }

  async getUserProjectPermissions(userId: number): Promise<number[]> {
    try {
      return await this.db.getUserProjectPermissions(userId);
    } catch (error) {
      console.error('Error getting user project permissions:', error);
      return [];
    }
  }

  async hasProjectPermission(userId: number, projectId: number): Promise<boolean> {
    try {
      // Admin users have access to all projects
      const user = await this.db.getUserById(userId);
      if (user && user.role === 'admin') {
        return true;
      }

      // Check specific project permissions
      const permissions = await this.getUserProjectPermissions(userId);
      return permissions.includes(projectId);
    } catch (error) {
      console.error('Error checking project permission:', error);
      return false;
    }
  }

  async addUserToProject(userId: number, projectId: number): Promise<boolean> {
    try {
      await this.db.addUserProjectPermission(userId, projectId);
      return true;
    } catch (error) {
      console.error('Error adding user to project:', error);
      return false;
    }
  }

  async removeUserFromProject(userId: number, projectId: number): Promise<boolean> {
    try {
      await this.db.removeUserProjectPermission(userId, projectId);
      return true;
    } catch (error) {
      console.error('Error removing user from project:', error);
      return false;
    }
  }

  async getAllUsers(): Promise<Omit<AuthUser, 'passwordHash'>[]> {
    try {
      return await this.db.getAllUsers();
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  async updateUserRole(userId: number, role: 'admin' | 'user'): Promise<boolean> {
    try {
      await this.db.updateUserRole(userId, role);
      return true;
    } catch (error) {
      console.error('Error updating user role:', error);
      return false;
    }
  }

  async deactivateUser(userId: number): Promise<boolean> {
    try {
      await this.db.deactivateUser(userId);
      return true;
    } catch (error) {
      console.error('Error deactivating user:', error);
      return false;
    }
  }

  generateToken(user: AuthUser): string {
    return jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      this.jwtSecret,
      { expiresIn: this.tokenExpiry }
    );
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
    }
  }
}

module.exports = { AuthService };