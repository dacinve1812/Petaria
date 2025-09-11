import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';

const UserContext = createContext(null);

// Action types
const USER_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_USER: 'SET_USER',
  CLEAR_USER: 'CLEAR_USER',
  SET_ERROR: 'SET_ERROR',
  UPDATE_USER_DATA: 'UPDATE_USER_DATA'
};

// Initial state
const initialState = {
  user: null,
  isLoading: true,
  error: null,
  isAuthenticated: false
};

// Reducer function
function userReducer(state, action) {
  switch (action.type) {
    case USER_ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload };
    case USER_ACTIONS.SET_USER:
      return {
        ...state,
        user: action.payload,
        isLoading: false,
        error: null,
        isAuthenticated: !!action.payload
      };
    case USER_ACTIONS.CLEAR_USER:
      return {
        ...state,
        user: null,
        isLoading: false,
        error: null,
        isAuthenticated: false
      };
    case USER_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        isAuthenticated: false
      };
    case USER_ACTIONS.UPDATE_USER_DATA:
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      };
    default:
      return state;
  }
}

// Token validation utility
const validateToken = (token) => {
  if (!token) return { isValid: false, decoded: null };
  
  try {
    const decoded = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    
    return {
      isValid: decoded.exp > currentTime,
      decoded: decoded,
      isExpired: decoded.exp <= currentTime
    };
  } catch (err) {
    return { isValid: false, decoded: null, error: err.message };
  }
};

// UserProvider component
export function UserProvider({ children }) {
  const [state, dispatch] = useReducer(userReducer, initialState);

  // Login function
  const login = useCallback(async (token, hasPet) => {
    localStorage.setItem('token', token);
    localStorage.setItem('hasPet', String(hasPet));
    
    const tokenValidation = validateToken(token);
    if (tokenValidation.isValid) {
      // Fetch user profile from backend to get admin status
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/user/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const userProfile = await response.json();
          const userData = {
            userId: userProfile.userId,
            username: userProfile.username,
            isAdmin: userProfile.isAdmin,
            token,
            role: userProfile.role,
            hasPet
          };
          dispatch({ type: USER_ACTIONS.SET_USER, payload: userData });
        } else {
          // Fallback to basic user data if API fails
          const userData = {
            userId: tokenValidation.decoded.userId,
            isAdmin: false, // Default to false for security
            token,
            role: 'user',
            hasPet
          };
          dispatch({ type: USER_ACTIONS.SET_USER, payload: userData });
        }
      } catch (err) {
        console.error('Error fetching user profile during login:', err);
        // Fallback to basic user data if API fails
        const userData = {
          userId: tokenValidation.decoded.userId,
          isAdmin: false, // Default to false for security
          token,
          role: 'user',
          hasPet
        };
        dispatch({ type: USER_ACTIONS.SET_USER, payload: userData });
      }
    }
  }, []);

  // Logout function
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('hasPet');
    dispatch({ type: USER_ACTIONS.CLEAR_USER });
  }, []);

  // Refresh token function
  const refreshToken = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/refresh-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        login(data.token, data.hasPet);
        return true;
      } else {
        // Token refresh failed, logout user
        logout();
        return false;
      }
    } catch (err) {
      console.error('Error refreshing token:', err);
      logout();
      return false;
    }
  }, [login, logout]);

  // Initialize user from localStorage on app start
  useEffect(() => {
    const initializeUser = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        dispatch({ type: USER_ACTIONS.SET_LOADING, payload: false });
        return;
      }

      const tokenValidation = validateToken(token);
      
      if (!tokenValidation.isValid) {
        // Token is invalid or expired, clear storage
        localStorage.removeItem('token');
        localStorage.removeItem('hasPet');
        dispatch({ type: USER_ACTIONS.CLEAR_USER });
        return;
      }

      // Token is valid, fetch user profile from backend
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/user/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const userProfile = await response.json();
          const userData = {
            userId: userProfile.userId,
            username: userProfile.username,
            isAdmin: userProfile.isAdmin,
            token,
            role: userProfile.role,
            hasPet: userProfile.hasPet
          };
          
          dispatch({ type: USER_ACTIONS.SET_USER, payload: userData });
        } else {
          // Token invalid on server, clear storage
          localStorage.removeItem('token');
          localStorage.removeItem('hasPet');
          dispatch({ type: USER_ACTIONS.CLEAR_USER });
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('hasPet');
        dispatch({ type: USER_ACTIONS.CLEAR_USER });
      }
    };

    initializeUser();
  }, []);

  // Auto-refresh token when it's about to expire (refresh 1 hour before expiry)
  useEffect(() => {
    if (!state.user || !state.isAuthenticated) return;

    const token = localStorage.getItem('token');
    const validation = validateToken(token);
    
    if (!validation.isValid) return;

    const timeUntilExpiry = validation.decoded.exp - Date.now() / 1000;
    const refreshTime = Math.max(0, timeUntilExpiry - 3600); // Refresh 1 hour before expiry

    if (refreshTime > 0) {
      const timer = setTimeout(() => {
        refreshToken();
      }, refreshTime * 1000);

      return () => clearTimeout(timer);
    }
  }, [state.user, state.isAuthenticated, refreshToken]);

  // Update user data function
  const updateUserData = (newData) => {
    dispatch({ type: USER_ACTIONS.UPDATE_USER_DATA, payload: newData });
  };

  // Check if token is still valid (useful for API calls)
  const isTokenValid = () => {
    const token = localStorage.getItem('token');
    const validation = validateToken(token);
    return validation.isValid;
  };

  // Get token info for debugging
  const getTokenInfo = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    const validation = validateToken(token);
    if (!validation.isValid) return null;
    
    return {
      token: token.substring(0, 20) + '...',
      decoded: validation.decoded,
      isExpired: validation.isExpired,
      expiresAt: new Date(validation.decoded.exp * 1000).toLocaleString(),
      timeUntilExpiry: Math.max(0, validation.decoded.exp - Date.now() / 1000)
    };
  };

  const value = {
    ...state,
    login,
    logout,
    updateUserData,
    isTokenValid,
    refreshToken,
    getTokenInfo
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

// Custom hook to use UserContext
export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

// Export the context for backward compatibility
export { UserContext };
