// AppContext.tsx
"use client";

import { ReactNode, createContext, useContext, useState, useEffect, useMemo } from "react";

interface AppState {
  email: string | null;
  setEmail: (email: string | null) => void;
  room: string | null;
  setRoom: (room: string | null) => void;
  isHost: boolean | null;
  setIsHost: (isHost: boolean | null) => void;
  token: string | null;
  setToken: (token: string | null) => void;
  isLoading: boolean;
}

interface AuthData {
  email: string | null;
  room: string | null;
  isHost: boolean | null;
  token: string | null;
}

const AppContext = createContext<AppState | null>(null);

const loadInitialAuthData = (): AuthData => {
  if (typeof window === "undefined") {
    return { email: null, room: null, isHost: null, token: null };
  }
  
  const token = localStorage.getItem("token");
  if (!token) {
    return { email: null, room: null, isHost: null, token: null };
  }

  return {
    token,
    email: localStorage.getItem("email") || null,
    room: localStorage.getItem("room") || null,
    isHost: localStorage.getItem("isHost") 
      ? JSON.parse(localStorage.getItem("isHost")!) 
      : null
  };
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [authData, setAuthData] = useState<AuthData>(loadInitialAuthData);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const updateAuthData = (newData: Partial<AuthData>) => {
    setAuthData(prev => {
      const updatedData = { ...prev, ...newData };
      
      if (typeof window !== "undefined") {
        if (updatedData.token) {
          localStorage.setItem("token", updatedData.token);
        } else {
          localStorage.removeItem("token");
        }
        
        localStorage.setItem("email", updatedData.email || "");
        localStorage.setItem("room", updatedData.room || "");
        localStorage.setItem("isHost", JSON.stringify(updatedData.isHost));
      }
      
      return updatedData;
    });
  };

  const contextValue = useMemo(() => ({
    email: authData.email,
    setEmail: (email: string | null) => updateAuthData({ email }),
    room: authData.room,
    setRoom: (room: string | null) => updateAuthData({ room }),
    isHost: authData.isHost,
    setIsHost: (isHost: boolean | null) => updateAuthData({ isHost }),
    token: authData.token,
    setToken: (token: string | null) => updateAuthData({ token }),
    isLoading
  }), [authData, isLoading]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};