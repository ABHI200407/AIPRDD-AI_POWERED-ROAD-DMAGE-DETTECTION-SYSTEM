import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('alive_auth'); // Clear any old manual storage
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const loginAsGuest = () => {
    const guestUser = { id: 'guest_' + Math.random().toString(36).substr(2, 9), type: 'guest', displayName: 'Guest Driver' };
    setCurrentUser(guestUser);
    localStorage.setItem('alive_guest', JSON.stringify(guestUser));
  };

  const value = {
    user: currentUser,
    isAuthenticated: !!currentUser,
    isGuest: currentUser?.type === 'guest',
    loading,
    logout,
    loginAsGuest
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
