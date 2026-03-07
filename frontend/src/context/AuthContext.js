import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore token on app load
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        const storedUser = await AsyncStorage.getItem('user');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authService.login(email, password);

    if (data.success) {
      // Store token first so the /me request can attach it via the interceptor
      await AsyncStorage.setItem('token', data.token);
      setToken(data.token);

      // Fetch the full profile from the DB so we always get the complete
      // profile_photo (not a potentially stale/truncated copy from the login
      // response cache or a too-small DB column before migration).
      let userToStore = data.user;
      try {
        const profileData = await authService.getProfile();
        if (profileData.success) {
          userToStore = { ...data.user, ...profileData.data };
        }
      } catch {
        // If /me fails (network hiccup), fall back to login-response user info
      }

      await AsyncStorage.setItem('user', JSON.stringify(userToStore));
      setUser(userToStore);
    }

    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setToken(null);
      setUser(null);
    }
  }, []);

  const updateUser = useCallback(async (updatedFields) => {
    const updated = { ...user, ...updatedFields };
    await AsyncStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  }, [user]);

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!token,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => { 
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
