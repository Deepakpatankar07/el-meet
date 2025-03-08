"use client";

import { ReactNode, createContext, useContext, useState, useEffect } from "react";

interface AppState {
  email: string | null;
  setEmail: (email: string | null) => void;
  room: string | null;
  setRoom: (room: string | null) => void;
  isHost: boolean | null;
  setIsHost: (isHost: boolean | null) => void;
  token: string | null;
  setToken: (token: string | null) => void;
}

export const AppContext = createContext<AppState | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [email, setEmail] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Load data from localStorage when the component mounts (client-side)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem("token");
      setToken(storedToken);

      setEmail(localStorage.getItem("email") || null);
      setRoom(localStorage.getItem("room") || null);
      const storedIsHost = localStorage.getItem("isHost");
      setIsHost(storedIsHost ? JSON.parse(storedIsHost) : null);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("token", token);
      } else {
        localStorage.removeItem("token");
      }
    }
  }, [token]);

  // Sync state with localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("email", email || "");
    }
  }, [email]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("room", room || "");
    }
  }, [room]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("isHost", JSON.stringify(isHost));
    }
  }, [isHost]);

  return (
    <AppContext.Provider value={{ email, setEmail, room, setRoom, isHost, setIsHost, token, setToken }}>
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
