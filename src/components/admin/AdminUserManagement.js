import React, { useState, useEffect } from 'react';
import './AdminUserManagement.css';
import { useNavigate } from 'react-router-dom';
const AdminUserManagement = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterVip, setFilterVip] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [usersPerPage] = useState(10);

  useEffect(() => {
    // Load user info
    const token = localStorage.getItem('token');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        setUser({
          userId: decoded.userId,
          isAdmin,
          token,
          role: isAdmin ? 'admin' : 'user'
        });
      } catch (err) {
        console.error('Invalid token');
        setUser(null);
      }
    } else {
      setUser(null);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && user.isAdmin) {
      fetchUsers();
    }
  }, [user, currentPage]);

  const fetchUsers = async () => {
    try {
      console.log('Fetching users...');
      const token = localStorage.getItem('token');
      console.log('Token:', token);
      
      // Check if token exists and is valid
      if (!token) {
        setMessage('No authentication token found. Please login again.');
        setMessageType('error');
        return;
      }
      
      // Decode token to check if it's valid
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        console.log('Decoded token:', decoded);
        
        // Check if token is expired
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
          setMessage('Token expired. Please login again.');
          setMessageType('error');
          return;
        }
      } catch (decodeError) {
        console.error('Token decode error:', decodeError);
        setMessage('Invalid token format. Please login again.');
        setMessageType('error');
        return;
      }
      
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const offset = (currentPage - 1) * usersPerPage;
      const response = await fetch(`${API_BASE_URL}/api/admin/users?page=${currentPage}&limit=${usersPerPage}&offset=${offset}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || data);
        setTotalPages(data.totalPages || 1);
        setTotalUsers(data.totalUsers || (data.users ? data.users.length : data.length) || 0);
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || 'Failed to fetch users');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setMessage('Error fetching users: ' + error.message);
      setMessageType('error');
    }
  };

  const updateUserRole = async (userId, newRole) => {
    try {
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (response.ok) {
        setMessage(`Successfully updated user role to ${newRole}`);
        setMessageType('success');
        fetchUsers();
      } else {
        const error = await response.json();
        setMessage(error.message || 'Failed to update user role');
        setMessageType('error');
      }
    } catch (error) {
      setMessage('Error updating user role');
      setMessageType('error');
    }
  };

  const toggleVipStatus = async (userId, currentVipStatus) => {
    try {
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/vip`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ is_vip: !currentVipStatus })
      });

      if (response.ok) {
        setMessage(`Successfully ${!currentVipStatus ? 'granted' : 'revoked'} VIP status`);
        setMessageType('success');
        fetchUsers();
      } else {
        const error = await response.json();
        setMessage(error.message || 'Failed to update VIP status');
        setMessageType('error');
      }
    } catch (error) {
      setMessage('Error updating VIP status');
      setMessageType('error');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesVip = filterVip === 'all' || 
                      (filterVip === 'vip' && user.is_vip) ||
                      (filterVip === 'normal' && !user.is_vip);
    
    return matchesSearch && matchesRole && matchesVip;
  });

  // Show loading while user is being loaded
  if (loading) {
    return (
      <div className="admin-user-management">
        <div className="access-denied">
          <h2>Loading...</h2>
          <p>Please wait while we verify your access.</p>
        </div>
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return (
      <div className="admin-user-management">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-user-management">
      <div className="admin-header">
          
          <div className="header-text">
            <h1>User Management</h1>
            <p>Manage user roles and VIP status</p>
          </div>
          <button 
            className="back-admin-btn"
            onClick={() => navigate('/admin')}
            title="Back to Admin Panel"
          >
            ← Back to Admin
          </button>
      </div>

      {message && (
        <div className={`message ${messageType}`}>
          {message}
        </div>
      )}

      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-controls">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="user">User</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
          
          <select
            value={filterVip}
            onChange={(e) => setFilterVip(e.target.value)}
          >
            <option value="all">All Users</option>
            <option value="vip">VIP Only</option>
            <option value="normal">Normal Only</option>
          </select>
        </div>
      </div>

      <div className="users-table-container">
        {loading ? (
          <div className="loading">Loading users...</div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Role</th>
                <th>VIP Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.username}</td>
                  <td>
                    <select
                      value={user.role}
                      onChange={(e) => updateUserRole(user.id, e.target.value)}
                      className="role-select"
                    >
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <span className={`vip-status ${user.is_vip ? 'vip' : 'normal'}`}>
                      {user.is_vip ? 'VIP' : 'Normal'}
                    </span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => toggleVipStatus(user.id, user.is_vip)}
                      className={`vip-toggle-btn ${user.is_vip ? 'revoke' : 'grant'}`}
                    >
                      {user.is_vip ? 'Revoke VIP' : 'Grant VIP'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="pagination-section">
        <div className="pagination-info">
          <span>Showing {((currentPage - 1) * usersPerPage) + 1} to {Math.min(currentPage * usersPerPage, totalUsers || users.length || 0)} of {totalUsers || users.length || 0} users</span>
        </div>
        
        <div className="pagination-controls">
          <button 
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="pagination-btn"
          >
            «« First
          </button>
          
          <button 
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="pagination-btn"
          >
            « Previous
          </button>
          
          <span className="pagination-page">
            Page {currentPage} of {totalPages}
          </span>
          
          <button 
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="pagination-btn"
          >
            Next »
          </button>
          
          <button 
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="pagination-btn"
          >
            Last »»
          </button>
        </div>
      </div>

      <div className="stats-section">
        <div className="stat-card">
          <h3>Total Users</h3>
          <span className="stat-number">{totalUsers || users.length || 0}</span>
        </div>
        <div className="stat-card">
          <h3>VIP Users</h3>
          <span className="stat-number">{users.filter(u => u.is_vip).length}</span>
        </div>
        <div className="stat-card">
          <h3>Normal Users</h3>
          <span className="stat-number">{users.filter(u => !u.is_vip).length}</span>
        </div>
      </div>
    </div>
  );
};

export default AdminUserManagement;
