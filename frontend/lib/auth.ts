// Authentication service for Chess Stats
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3008';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'moderator' | 'user';
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  lastLogin: string | null;
  bio?: string;
  location?: string;
  website?: string;
  chessComUsername?: string;
  lichessUsername?: string;
  preferredTimeControl?: 'bullet' | 'blitz' | 'rapid' | 'classical';
  notifications?: {
    email: boolean;
    push: boolean;
    gameUpdates: boolean;
    tournamentUpdates: boolean;
  };
}

export interface AuthTokens {
  accessToken: string;
}

export interface LoginCredentials {
  identifier: string; // username or email
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: User;
  tokens: AuthTokens;
}

class AuthService {
  private baseURL = `${API_URL}/api/auth`;

  // Set up axios interceptors for token handling
  constructor() {
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Add token to requests
    axios.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Handle token refresh on 401 responses
    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && !error.config._retry) {
          error.config._retry = true;
          
          try {
            await this.refreshToken();
            const token = this.getToken();
            if (token) {
              error.config.headers.Authorization = `Bearer ${token}`;
              return axios.request(error.config);
            }
          } catch (refreshError) {
            this.logout();
            if (typeof window !== 'undefined') {
              window.location.href = '/auth/login';
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication methods
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${this.baseURL}/login`, credentials, {
        withCredentials: true // Important for cookies
      });
      
      if (response.data.success) {
        this.setToken(response.data.tokens.accessToken);
        this.setUser(response.data.user);
      }
      
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${this.baseURL}/register`, data, {
        withCredentials: true
      });
      
      if (response.data.success) {
        this.setToken(response.data.tokens.accessToken);
        this.setUser(response.data.user);
      }
      
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/logout`, {}, {
        withCredentials: true
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearAuth();
    }
  }

  async refreshToken(): Promise<AuthResponse> {
    try {
      const response = await axios.post(`${this.baseURL}/refresh`, {}, {
        withCredentials: true
      });
      
      if (response.data.success) {
        this.setToken(response.data.tokens.accessToken);
        this.setUser(response.data.user);
      }
      
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getProfile(): Promise<User> {
    try {
      const response = await axios.get(`${this.baseURL}/profile`);
      return response.data.user;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateProfile(updates: Partial<User>): Promise<User> {
    try {
      const response = await axios.put(`${this.baseURL}/profile`, updates);
      const updatedUser = response.data.user;
      this.setUser(updatedUser);
      return updatedUser;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await axios.post(`${this.baseURL}/change-password`, {
        currentPassword,
        newPassword
      });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteAccount(): Promise<void> {
    try {
      await axios.delete(`${this.baseURL}/account`);
      this.clearAuth();
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Token management
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('chess_stats_token');
  }

  private setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('chess_stats_token', token);
  }

  private clearToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('chess_stats_token');
  }

  // User management
  getUser(): User | null {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('chess_stats_user');
    return userStr ? JSON.parse(userStr) : null;
  }

  private setUser(user: User): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('chess_stats_user', JSON.stringify(user));
  }

  private clearUser(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('chess_stats_user');
  }

  private clearAuth(): void {
    this.clearToken();
    this.clearUser();
  }

  // Auth state helpers
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  hasRole(role: User['role']): boolean {
    const user = this.getUser();
    return user?.role === role;
  }

  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  isModerator(): boolean {
    const user = this.getUser();
    return user?.role === 'admin' || user?.role === 'moderator';
  }

  // Check if token is expired (basic check)
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  // Initialize auth on app start
  async initialize(): Promise<User | null> {
    const token = this.getToken();
    if (!token || this.isTokenExpired()) {
      this.clearAuth();
      return null;
    }

    try {
      const user = await this.getProfile();
      this.setUser(user);
      return user;
    } catch (error) {
      console.error('Auth initialization failed:', error);
      this.clearAuth();
      return null;
    }
  }

  // Error handling
  private handleError(error: any): Error {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.response?.data?.error || error.message;
      return new Error(message);
    }
    return error instanceof Error ? error : new Error('Unknown error occurred');
  }

  // Admin methods
  async getUserStats() {
    if (!this.isAdmin()) {
      throw new Error('Admin access required');
    }

    try {
      const response = await axios.get(`${this.baseURL}/admin/users`);
      return response.data.stats;
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;