"use client";
import { useAppContext } from "@/context/AppContext";
import React from "react";
import { useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";
import { IoMdSend } from "react-icons/io";

interface Message {
  name: string;
  content: string;
  event?: string;
}

interface Participant {
  userId: string;
  status: "online" | "offline";
}

const Chat = () => {
  const { name, room, isHost } = useAppContext();
  const action = isHost ? "create" : "join";
  const [activeTab, setActiveTab] = useState("Chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!name || !room || wsRef.current) {
      console.log("Missing name, room or wsRef");
      return;
    }

    const ws = new WebSocket("ws://localhost:8080");

    ws.onopen = () => {
      console.log("WebSocket connected, sending data:", { action, room, name });
      ws.send(JSON.stringify({ action:action, room, name }));
      wsRef.current = ws;
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("Message received:", message);

      switch (message.event) {
        case "roomCreated":
          console.log("Room created:", message.room);
          setMessages((prev) => [ ...prev, { name: "System", content:message.content } ]);
          break;
          
        case "roomJoined":
          console.log("Room joined:", message.room);
          setMessages((prev) => [ ...prev, { name: "System", content:message.content } ]);
          break;

        case "participants":
          setParticipants(message.participants);
          break;

        case "message":
          setMessages((prev) => [...prev, message]);
          break;

        case "error":
          console.error("WebSocket Error:", message.error);
          break;

        default:
          console.log("Unknown event:", message.event);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      wsRef.current = null;
    };

    return () => {
      console.log("Cleaning up WebSocket for room:", room);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    };
  }, [room, name]);

  const sendMessage = () => {
    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      input.trim()
    ) {
      wsRef.current.send(
        JSON.stringify({ action: "message", room, name, content: input })
      );
      setInput("");
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen text-white">
      <div className="w-full h-[87vh] rounded-xl shadow-lg flex flex-col">
        {/* Tabs */}
        <div className="flex p-4 gap-4 border-b border-gray-700">
          <button
            className={`flex-1 py-2 rounded-md text-center ${
              activeTab === "Chat" ? "border border-zinc-800 bg-zinc-900" : ""
            }`}
            onClick={() => setActiveTab("Chat")}
          >
            Chat
          </button>
          <button
            className={`flex-1 py-2 rounded-md text-center ${
              activeTab === "Participants"
                ? "border border-zinc-800 bg-zinc-900"
                : ""
            }`}
            onClick={() => setActiveTab("Participants")}
          >
            Participants
          </button>
        </div>

        {activeTab === "Participants" ? (
          <div className="p-4 overflow-auto flex flex-col space-y-2 flex-1">
            {isHost && (
              <p className="text-sm text-gray-500/50 text-center">
                You are the host
              </p>
            )}
            <p className="text-sm text-gray-500/50 text-center">
              Participants:
            </p>
            {participants.map((participant, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    participant.status === "online"
                      ? "bg-green-500"
                      : "bg-gray-500"
                  }`}
                />
                <p className="text-sm text-gray-500/50">{participant.userId}</p>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Messages Section */}
            <div className="py-4 px-2 overflow-auto flex flex-col space-y-2 flex-1">
              {messages.map((msg, i) => (
                msg.name === "System" ? (
                  <div key={i} className="">
                    <p className="text-xs text-gray-500/50 text-center bg-gray-700/50 px-2 rounded-md w-fit mx-auto">
                      {msg.content}
                    </p>
                  </div>
                ) : (
                  <div
                    key={i}
                    className={`flex items-start gap-2 ${
                      msg.name === name ? "justify-end" : "justify-start"
                    }`}
                  >
                    {/* Avatar */}
                    {msg.name !== name && (
                      <div className="text-xs bg-white/5 backdrop-blur-sm text-white hover:bg-white/10 text-center w-8 h-8 border border-zinc-800 rounded-full flex items-center justify-center">
                        {msg.name ? msg.name.charAt(0).toUpperCase() : "A"}
                      </div>
                    )}

                    {/* Message Box */}
                    <div
                      className={`py-2 px-4 rounded-lg max-w-xs break-words ${
                        msg.name === name
                          ? "bg-blue-500/70 hover:bg-blue-500/80 text-white ml-auto flex flex-row-reverse"
                          : "bg-white/5 backdrop-blur-sm text-white hover:bg-white/10"
                      } flex items-center gap-2`}
                    >
                      <div className="text-sm">
                        <p className="text-white/30 mb-1 text-xs">{msg.name}</p>
                        <p className="break-words">{msg.content}</p>
                      </div>
                    </div>

                    {/* Avatar (for sent messages) */}
                    {msg.name === name && (
                      <div className="text-xs bg-white/5 backdrop-blur-sm text-white hover:bg-white/10 text-center w-8 h-8 border border-zinc-800 rounded-full flex items-center justify-center">
                        {msg.name ? msg.name.charAt(0).toUpperCase() : "A"}
                      </div>
                    )}
                  </div>
                )
              ))}
            </div>

            {/* Input Section */}
            <div className="p-4 gap-4 border-t border-gray-700 flex items-center">
              <input
                className="flex-1 p-2 border border-zinc-800 bg-zinc-900/50 rounded-md focus:outline-none"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Write a message..."
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button
                className=" bg-blue-600 px-4 py-2 rounded-md"
                onClick={sendMessage}
              >
                <IoMdSend className="text-2xl" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Chat;
