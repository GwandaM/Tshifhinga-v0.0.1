import { LoggerService } from './logger-service';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
}

interface ValidationOptions {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => boolean | string;
  sanitize?: boolean;
}

class ValidationService {
  private static instance: ValidationService;
  private logger: LoggerService;

  private constructor() {
    this.logger = LoggerService.getInstance();
  }

  public static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  // Basic sanitization
  public sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/[<>]/g, '') // Remove potential HTML characters
      .substring(0, 1000); // Limit length
  }

  public sanitizeHtml(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim()
      .substring(0, 5000);
  }

  public sanitizeEmail(email: string): string {
    if (typeof email !== 'string') return '';
    
    return email
      .toLowerCase()
      .trim()
      .substring(0, 254); // RFC 5321 limit
  }

  public sanitizeNumber(input: any): number | null {
    const num = Number(input);
    return isNaN(num) ? null : num;
  }

  public sanitizeBoolean(input: any): boolean {
    if (typeof input === 'boolean') return input;
    if (typeof input === 'string') {
      return input.toLowerCase() === 'true' || input === '1';
    }
    if (typeof input === 'number') {
      return input !== 0;
    }
    return false;
  }

  // Validation methods
  public validateString(value: any, options: ValidationOptions = {}): ValidationResult {
    const errors: string[] = [];
    let sanitizedValue = value;

    // Type check
    if (value !== null && value !== undefined && typeof value !== 'string') {
      value = String(value);
    }

    // Required check
    if (options.required && (!value || value.trim().length === 0)) {
      errors.push('Value is required');
      return { isValid: false, errors };
    }

    if (value) {
      // Sanitize if requested
      if (options.sanitize) {
        sanitizedValue = this.sanitizeString(value);
      }

      // Length checks
      if (options.minLength && value.length < options.minLength) {
        errors.push(`Value must be at least ${options.minLength} characters long`);
      }
      
      if (options.maxLength && value.length > options.maxLength) {
        errors.push(`Value must not exceed ${options.maxLength} characters`);
      }

      // Pattern check
      if (options.pattern && !options.pattern.test(value)) {
        errors.push('Value does not match required format');
      }

      // Custom validation
      if (options.customValidator) {
        const result = options.customValidator(value);
        if (typeof result === 'string') {
          errors.push(result);
        } else if (!result) {
          errors.push('Value failed custom validation');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue
    };
  }

  public validateEmail(email: any): ValidationResult {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    const result = this.validateString(email, {
      required: true,
      maxLength: 254,
      pattern: emailRegex,
      sanitize: true
    });

    if (result.isValid && result.sanitizedValue) {
      result.sanitizedValue = this.sanitizeEmail(result.sanitizedValue);
    }

    return result;
  }

  public validateUsername(username: any): ValidationResult {
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    
    return this.validateString(username, {
      required: true,
      minLength: 3,
      maxLength: 50,
      pattern: usernameRegex,
      sanitize: true,
      customValidator: (value) => {
        // Additional username rules
        if (value.startsWith('-') || value.endsWith('-')) {
          return 'Username cannot start or end with a hyphen';
        }
        if (value.includes('__')) {
          return 'Username cannot contain consecutive underscores';
        }
        return true;
      }
    });
  }

  public validatePassword(password: any): ValidationResult {
    const errors: string[] = [];

    if (!password || typeof password !== 'string') {
      errors.push('Password is required');
      return { isValid: false, errors };
    }

    // Length check
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }

    // Complexity checks
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Common password check
    const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein'];
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public validateNumber(value: any, min?: number, max?: number): ValidationResult {
    const errors: string[] = [];
    const sanitizedValue = this.sanitizeNumber(value);

    if (sanitizedValue === null) {
      errors.push('Value must be a valid number');
      return { isValid: false, errors };
    }

    if (min !== undefined && sanitizedValue < min) {
      errors.push(`Value must be at least ${min}`);
    }

    if (max !== undefined && sanitizedValue > max) {
      errors.push(`Value must not exceed ${max}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue
    };
  }

  public validateId(id: any): ValidationResult {
    const result = this.validateNumber(id, 1);
    if (!result.isValid) {
      return { isValid: false, errors: ['Invalid ID'] };
    }

    // Ensure it's an integer
    if (!Number.isInteger(result.sanitizedValue!)) {
      return { isValid: false, errors: ['ID must be an integer'] };
    }

    return result;
  }

  public validateRole(role: any): ValidationResult {
    const validRoles = ['admin', 'user', 'director'];
    
    if (!role || !validRoles.includes(role)) {
      return {
        isValid: false,
        errors: [`Role must be one of: ${validRoles.join(', ')}`]
      };
    }

    return {
      isValid: true,
      errors: [],
      sanitizedValue: role
    };
  }

  public validateSessionData(sessionData: any): ValidationResult {
    const errors: string[] = [];
    const sanitized: any = {};

    // Validate required fields
    const clientResult = this.validateString(sessionData.client, {
      required: true,
      maxLength: 100,
      sanitize: true
    });
    if (!clientResult.isValid) {
      errors.push(...clientResult.errors.map(e => `Client: ${e}`));
    } else {
      sanitized.client = clientResult.sanitizedValue;
    }

    const projectResult = this.validateString(sessionData.project, {
      required: true,
      maxLength: 100,
      sanitize: true
    });
    if (!projectResult.isValid) {
      errors.push(...projectResult.errors.map(e => `Project: ${e}`));
    } else {
      sanitized.project = projectResult.sanitizedValue;
    }

    const taskResult = this.validateString(sessionData.task, {
      required: true,
      maxLength: 100,
      sanitize: true
    });
    if (!taskResult.isValid) {
      errors.push(...taskResult.errors.map(e => `Task: ${e}`));
    } else {
      sanitized.task = taskResult.sanitizedValue;
    }

    // Validate timestamps
    const startResult = this.validateNumber(sessionData.start, 0);
    if (!startResult.isValid) {
      errors.push('Start time must be a valid timestamp');
    } else {
      sanitized.start = startResult.sanitizedValue;
    }

    if (sessionData.end !== null && sessionData.end !== undefined) {
      const endResult = this.validateNumber(sessionData.end, 0);
      if (!endResult.isValid) {
        errors.push('End time must be a valid timestamp');
      } else {
        sanitized.end = endResult.sanitizedValue;
        
        // Validate end > start
        if (sanitized.start && sanitized.end <= sanitized.start) {
          errors.push('End time must be after start time');
        }
      }
    }

    // Validate time durations
    const activeMsResult = this.validateNumber(sessionData.activeMs, 0);
    if (!activeMsResult.isValid) {
      errors.push('Active time must be a non-negative number');
    } else {
      sanitized.activeMs = activeMsResult.sanitizedValue;
    }

    const pausedMsResult = this.validateNumber(sessionData.pausedMs, 0);
    if (!pausedMsResult.isValid) {
      errors.push('Paused time must be a non-negative number');
    } else {
      sanitized.pausedMs = pausedMsResult.sanitizedValue;
    }

    // Validate optional fields
    if (sessionData.notes) {
      const notesResult = this.validateString(sessionData.notes, {
        maxLength: 1000,
        sanitize: true
      });
      if (notesResult.isValid) {
        sanitized.notes = notesResult.sanitizedValue;
      }
    }

    if (sessionData.userId) {
      const userIdResult = this.validateId(sessionData.userId);
      if (userIdResult.isValid) {
        sanitized.userId = userIdResult.sanitizedValue;
      }
    }

    // Validate boolean fields
    if (sessionData.isBillable !== undefined) {
      sanitized.isBillable = this.sanitizeBoolean(sessionData.isBillable);
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: sanitized
    };
  }

  public validateUserData(userData: any): ValidationResult {
    const errors: string[] = [];
    const sanitized: any = {};

    // Validate username
    const usernameResult = this.validateUsername(userData.username);
    if (!usernameResult.isValid) {
      errors.push(...usernameResult.errors.map(e => `Username: ${e}`));
    } else {
      sanitized.username = usernameResult.sanitizedValue;
    }

    // Validate email
    const emailResult = this.validateEmail(userData.email);
    if (!emailResult.isValid) {
      errors.push(...emailResult.errors.map(e => `Email: ${e}`));
    } else {
      sanitized.email = emailResult.sanitizedValue;
    }

    // Validate role
    if (userData.role) {
      const roleResult = this.validateRole(userData.role);
      if (!roleResult.isValid) {
        errors.push(...roleResult.errors);
      } else {
        sanitized.role = roleResult.sanitizedValue;
      }
    }

    // Validate optional fields
    const optionalStringFields = ['name', 'surname', 'team', 'region', 'jobLevel'];
    for (const field of optionalStringFields) {
      if (userData[field]) {
        const result = this.validateString(userData[field], {
          maxLength: 100,
          sanitize: true
        });
        if (result.isValid) {
          sanitized[field] = result.sanitizedValue;
        }
      }
    }

    // Validate numeric fields
    if (userData.billableRate !== undefined) {
      const rateResult = this.validateNumber(userData.billableRate, 0, 10000);
      if (rateResult.isValid) {
        sanitized.billableRate = rateResult.sanitizedValue;
      }
    }

    if (userData.discountPercentage !== undefined) {
      const discountResult = this.validateNumber(userData.discountPercentage, 0, 100);
      if (discountResult.isValid) {
        sanitized.discountPercentage = discountResult.sanitizedValue;
      }
    }

    if (userData.targetUtilization !== undefined) {
      const utilizationResult = this.validateNumber(userData.targetUtilization, 0, 100);
      if (utilizationResult.isValid) {
        sanitized.targetUtilization = utilizationResult.sanitizedValue;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: sanitized
    };
  }

  public logValidationFailure(context: string, errors: string[], input?: any): void {
    this.logger.securityEvent('VALIDATION_FAILURE', {
      context,
      errors,
      inputType: typeof input,
      timestamp: new Date().toISOString()
    });
  }
}

export { ValidationService, ValidationResult, ValidationOptions };

// CommonJS export for compatibility
module.exports = { ValidationService };