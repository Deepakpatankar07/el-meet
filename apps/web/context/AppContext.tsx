"use client";

import { ReactNode, createContext, useContext, useState, useEffect } from "react";

interface AppState {
  name: string | null;
  setName: (name: string | null) => void;
  room: string | null;
  setRoom: (room: string | null) => void;
  isHost: boolean | null;
  setIsHost: (isHost: boolean | null) => void;
  isLoadingStorage: boolean; // New state to track localStorage loading
}

export const AppContext = createContext<AppState | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [name, setName] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(true); // New state

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("name");
      const storedRoom = localStorage.getItem("room");
      const storedIsHost = localStorage.getItem("isHost");

      setName(storedName || null);
      setRoom(storedRoom || null);
      setIsHost(storedIsHost ? JSON.parse(storedIsHost) : null);
      
      setIsLoadingStorage(false); // ✅ Done loading storage
    }
  }, []);

  useEffect(() => {
    if (name !== null) localStorage.setItem("name", name);
  }, [name]);
  
  useEffect(() => {
    if (room !== null) localStorage.setItem("room", room);
  }, [room]);
  
  useEffect(() => {
    if (isHost !== null) localStorage.setItem("isHost", JSON.stringify(isHost));
  }, [isHost]);
  

  return (
    <AppContext.Provider value={{ name, setName, room, setRoom, isHost, setIsHost, isLoadingStorage }}>
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



/* "use client";

import { ReactNode, createContext, useContext, useState, useEffect } from "react";

interface AppState {
  name: string | null;
  setName: (name: string | null) => void;
  room: string | null;
  setRoom: (room: string | null) => void;
  isHost: boolean | null;
  setIsHost: (isHost: boolean | null) => void;
}

export const AppContext = createContext<AppState | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [name, setName] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean | null>(null);

  // Load data from localStorage when the component mounts (client-side)
  useEffect(() => {
    if (typeof window !== "undefined") {
      setName(localStorage.getItem("name") || null);
      setRoom(localStorage.getItem("room") || null);
      const storedIsHost = localStorage.getItem("isHost");
      setIsHost(storedIsHost ? JSON.parse(storedIsHost) : null);
    }
  }, []);

  // Sync state with localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("name", name || "");
    }
  }, [name]);

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
    <AppContext.Provider value={{ name, setName, room, setRoom, isHost, setIsHost }}>
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
 */