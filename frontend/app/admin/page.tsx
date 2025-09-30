'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  Users, Shield, Settings, Activity, BarChart3, Search, 
  Filter, MoreVertical, UserCheck, UserX, Crown, AlertTriangle,
  Calendar, Mail, Edit, Trash2, Eye, Ban, CheckCircle, XCircle
} from 'lucide-react';

interface AdminUser {
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
  loginCount: number;
  ipAddress?: string;
}

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  adminCount: number;
  moderatorCount: number;
  bannedUsers: number;
  unverifiedUsers: number;
}

interface UserFilters {
  role?: 'all' | 'admin' | 'moderator' | 'user';
  status?: 'all' | 'active' | 'banned' | 'unverified';
  search?: string;
}

export default function AdminDashboard() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    activeUsers: 0,
    newUsersToday: 0,
    newUsersThisWeek: 0,
    adminCount: 0,
    moderatorCount: 0,
    bannedUsers: 0,
    unverifiedUsers: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [filters, setFilters] = useState<UserFilters>({
    role: 'all',
    status: 'all',
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 20;

  // Redirect if not admin
  useEffect(() => {
    if (isAuthenticated && !isAdmin()) {
      router.push('/');
    }
  }, [isAuthenticated, isAdmin, router]);

  // Mock data - in real app this would come from API
  useEffect(() => {
    const fetchAdminData = async () => {
      setLoading(true);
      try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mock users data
        const mockUsers: AdminUser[] = [
          {
            id: '1',
            username: 'admin',
            email: 'admin@chessstats.com',
            firstName: 'Admin',
            lastName: 'User',
            role: 'admin',
            isActive: true,
            isVerified: true,
            createdAt: '2024-01-15T10:30:00Z',
            lastLogin: '2024-01-20T15:45:00Z',
            loginCount: 142,
            ipAddress: '192.168.1.1'
          },
          {
            id: '2',
            username: 'moderator1',
            email: 'mod1@chessstats.com',
            firstName: 'John',
            lastName: 'Moderator',
            role: 'moderator',
            isActive: true,
            isVerified: true,
            createdAt: '2024-01-16T09:15:00Z',
            lastLogin: '2024-01-19T12:30:00Z',
            loginCount: 87,
            ipAddress: '192.168.1.2'
          },
          {
            id: '3',
            username: 'user123',
            email: 'user123@gmail.com',
            firstName: 'Alice',
            lastName: 'Player',
            role: 'user',
            isActive: true,
            isVerified: true,
            createdAt: '2024-01-17T14:20:00Z',
            lastLogin: '2024-01-20T10:15:00Z',
            loginCount: 23,
            ipAddress: '203.45.67.89'
          },
          {
            id: '4',
            username: 'banneduser',
            email: 'banned@example.com',
            firstName: 'Banned',
            lastName: 'User',
            role: 'user',
            isActive: false,
            isVerified: true,
            createdAt: '2024-01-10T08:45:00Z',
            lastLogin: '2024-01-15T16:00:00Z',
            loginCount: 5,
            ipAddress: '45.67.89.12'
          },
          {
            id: '5',
            username: 'newuser',
            email: 'new@example.com',
            firstName: 'New',
            lastName: 'User',
            role: 'user',
            isActive: true,
            isVerified: false,
            createdAt: '2024-01-20T11:30:00Z',
            lastLogin: null,
            loginCount: 0,
            ipAddress: '123.45.67.89'
          }
        ];

        setUsers(mockUsers);

        // Mock system stats
        setStats({
          totalUsers: mockUsers.length,
          activeUsers: mockUsers.filter(u => u.isActive).length,
          newUsersToday: 2,
          newUsersThisWeek: 5,
          adminCount: mockUsers.filter(u => u.role === 'admin').length,
          moderatorCount: mockUsers.filter(u => u.role === 'moderator').length,
          bannedUsers: mockUsers.filter(u => !u.isActive).length,
          unverifiedUsers: mockUsers.filter(u => !u.isVerified).length
        });

      } catch (err: any) {
        setError(err.message || 'Failed to load admin data');
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && isAdmin()) {
      fetchAdminData();
    }
  }, [isAuthenticated, isAdmin]);

  const handleUserAction = async (action: string, userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const confirmMessage = {
      'ban': `Are you sure you want to ban ${user.username}?`,
      'unban': `Are you sure you want to unban ${user.username}?`,
      'verify': `Are you sure you want to verify ${user.username}?`,
      'promote': `Are you sure you want to promote ${user.username} to moderator?`,
      'demote': `Are you sure you want to demote ${user.username} to user?`,
      'delete': `Are you sure you want to DELETE ${user.username}? This action cannot be undone.`
    }[action];

    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }

    try {
      // Mock API call
      console.log(`Performing ${action} on user ${userId}`);
      
      // Update local state for demo
      setUsers(prevUsers => prevUsers.map(u => {
        if (u.id !== userId) return u;
        
        switch (action) {
          case 'ban':
            return { ...u, isActive: false };
          case 'unban':
            return { ...u, isActive: true };
          case 'verify':
            return { ...u, isVerified: true };
          case 'promote':
            return { ...u, role: 'moderator' as const };
          case 'demote':
            return { ...u, role: 'user' as const };
          default:
            return u;
        }
      }).filter(u => action !== 'delete' || u.id !== userId));
      
      setSelectedUser(null);
      setShowUserModal(false);
      
    } catch (err) {
      alert(`Failed to ${action} user`);
    }
  };

  const filteredUsers = users.filter(user => {
    if (filters.role && filters.role !== 'all' && user.role !== filters.role) {
      return false;
    }
    
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'active' && !user.isActive) return false;
      if (filters.status === 'banned' && user.isActive) return false;
      if (filters.status === 'unverified' && user.isVerified) return false;
    }
    
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return user.username.toLowerCase().includes(search) ||
             user.email.toLowerCase().includes(search) ||
             (user.firstName + ' ' + user.lastName).toLowerCase().includes(search);
    }
    
    return true;
  });

  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * usersPerPage,
    currentPage * usersPerPage
  );

  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'moderator': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (user: AdminUser) => {
    if (!user.isActive) return 'bg-red-100 text-red-800';
    if (!user.isVerified) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getStatusText = (user: AdminUser) => {
    if (!user.isActive) return 'Banned';
    if (!user.isVerified) return 'Unverified';
    return 'Active';
  };

  if (!isAuthenticated || !isAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage users and monitor system activity</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* System Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeUsers}</p>
              </div>
              <UserCheck className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">New This Week</p>
                <p className="text-2xl font-bold text-blue-600">{stats.newUsersThisWeek}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Issues</p>
                <p className="text-2xl font-bold text-red-600">{stats.bannedUsers + stats.unverifiedUsers}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </div>
        </div>

        {/* User Management */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
              <div className="flex items-center gap-2">
                <select
                  value={filters.role}
                  onChange={(e) => setFilters({ ...filters, role: e.target.value as any })}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="moderator">Moderator</option>
                  <option value="user">User</option>
                </select>
                
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="banned">Banned</option>
                  <option value="unverified">Unverified</option>
                </select>
              </div>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">
                            {(user.firstName?.[0] || user.username[0]).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.username}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                          <div className="text-sm text-gray-500">
                            {user.firstName} {user.lastName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(user.role)}`}>
                        {user.role === 'admin' && <Crown className="w-3 h-3 mr-1" />}
                        {user.role === 'moderator' && <Shield className="w-3 h-3 mr-1" />}
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(user)}`}>
                        {user.isActive ? (
                          user.isVerified ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1" />
                        )}
                        {getStatusText(user)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.lastLogin ? (
                        <div>{new Date(user.lastLogin).toLocaleDateString()}</div>
                      ) : (
                        <span className="text-gray-400">Never</span>
                      )}
                      <div className="text-xs text-gray-400">{user.loginCount} logins</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowUserModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {(currentPage - 1) * usersPerPage + 1} to {Math.min(currentPage * usersPerPage, filteredUsers.length)} of {filteredUsers.length} users
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Action Modal */}
        {showUserModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    Manage User: {selectedUser.username}
                  </h3>
                  <button
                    onClick={() => setShowUserModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">
                        {(selectedUser.firstName?.[0] || selectedUser.username[0]).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">{selectedUser.firstName} {selectedUser.lastName}</div>
                      <div className="text-sm text-gray-500">{selectedUser.email}</div>
                      <div className="text-xs text-gray-400">IP: {selectedUser.ipAddress}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {selectedUser.isActive ? (
                      <button
                        onClick={() => handleUserAction('ban', selectedUser.id)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Ban className="w-4 h-4" />
                        Ban User
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUserAction('unban', selectedUser.id)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-green-600 hover:bg-green-50 rounded"
                      >
                        <UserCheck className="w-4 h-4" />
                        Unban User
                      </button>
                    )}

                    {!selectedUser.isVerified && (
                      <button
                        onClick={() => handleUserAction('verify', selectedUser.id)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Verify User
                      </button>
                    )}

                    {selectedUser.role === 'user' && (
                      <button
                        onClick={() => handleUserAction('promote', selectedUser.id)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-purple-600 hover:bg-purple-50 rounded"
                      >
                        <Shield className="w-4 h-4" />
                        Promote to Moderator
                      </button>
                    )}

                    {selectedUser.role === 'moderator' && (
                      <button
                        onClick={() => handleUserAction('demote', selectedUser.id)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-yellow-600 hover:bg-yellow-50 rounded"
                      >
                        <Users className="w-4 h-4" />
                        Demote to User
                      </button>
                    )}

                    <hr className="my-2" />

                    <button
                      onClick={() => handleUserAction('delete', selectedUser.id)}
                      className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete User
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}