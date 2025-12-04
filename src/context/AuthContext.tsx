import React, { createContext, useState, useEffect, useContext } from 'react';
import { api } from '../servicios/api';

interface User {
  id: number;
  nombre: string;
  email: string;
  rol: 'streamer' | 'espectador';
  monedas: number;
  puntosXP: number;
  nivelEspectador: number;
  horasStream: number;
  nivelStreamer: number;
}

interface AuthContextType {
  user: User | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = (token: string, userData: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userData.id.toString());
    setUser(userData);
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  const refreshUser = async () => {
    const id = localStorage.getItem('userId');
    if (id) {
        try {
            const data = await api.get(`/user/${id}`);
            if (data.nombre) setUser(data);
        } catch (e) { console.error(e); }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);