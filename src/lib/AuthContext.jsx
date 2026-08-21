import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import db from '@/lib/localdb';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const checkUserAuth = useCallback(async () => {
    const u = await db.auth.me();
    setUser(u);
    setAuthChecked(true);
    setIsLoadingAuth(false);
    return u;
  }, []);

  useEffect(() => { checkUserAuth(); }, [checkUserAuth]);

  const logout = async () => {
    await db.auth.logout();
    setUser(null);
    window.location.href = import.meta.env.BASE_URL + 'login';
  };

  const navigateToLogin = () => { window.location.href = import.meta.env.BASE_URL + 'login'; };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError: null,
        authChecked,
        appPublicSettings: null,
        checkUserAuth,
        navigateToLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
