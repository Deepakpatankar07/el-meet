import { WebSocket_URL } from "@/config";
import { useAppContext } from "@/context/AppContext";
import { useEffect, useState } from "react";

export function useSocket() {
  const { room, email } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (!room || !email) {
      console.warn("Missing room or email, cannot connect WebSocket.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      console.error("Missing auth token.");
      return;
    }

    const ws = new WebSocket(`${WebSocket_URL}?roomId=${room}&token=${token}`);

    ws.onopen = () => {
      console.log(`WebSocket connected to room: ${room}`);
      setLoading(false);
      setSocket(ws);
    };

    ws.onerror = (error) => {
      console.warn("WebSocket Error:", error);
      setLoading(false);
    };

    ws.onclose = () => {
      console.log(`WebSocket closed for room: ${room}`);
      setSocket(null);
      setLoading(true);
    };

    // Cleanup on unmount or refresh
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      console.log("Cleaning up WebSocket in useSocket");
    };
  }, [room, email]);

  return { ws: socket, loading };
}
