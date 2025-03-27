"use client";
import { WS_BACKEND_URL } from "@/config";
import { useAppContext } from "@/context/AppContext";
import { useSocket } from "@/hooks/useSocket";
import axios from "axios";
import React, { forwardRef, useImperativeHandle,useEffect, useState, useRef } from "react";
import { IoMdSend } from "react-icons/io";

interface Message {
  email: string;
  content: string;
  event?: string;
  timestamp?: number;
  messageId: number;
}

interface Participant {
  email: string;
  status: "online" | "offline";
}
export interface ChatRef {
  closeChatConnection: () => Promise<void>;
}

const Chat = forwardRef<ChatRef>((_, ref) => {
  const { ws, loading } = useSocket();
  const { email, room, isHost } = useAppContext();
  const [activeTab, setActiveTab] = useState("Chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [allHistoryLoaded, setAllHistoryLoaded] = useState(false);
  const [cursor, setCursor] = useState(
    Date.now() * 1000000 + Number.MAX_SAFE_INTEGER
  );
  const messageContainerRef = useRef<HTMLDivElement>(null);

  const fetchHistory = async () => {
    if (allHistoryLoaded || loadingHistory) return;

    setLoadingHistory(true);

    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log("Fetching history with cursor:", cursor);
      ws.send(
        JSON.stringify({ action: "getHistory", room, cursor, limit: 20 })
      );
    } else {
      console.log("WebSocket not ready, retrying later...");
      setTimeout(fetchHistory, 1000);
    }
  };
  const closeChatConnection = async () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    return new Promise<void>((resolve) => {
      console.log("Closing WebSocket...");
      if(isHost){
        const EndMeeting = { action: "endmeeting", room, email };
        ws.send(JSON.stringify(EndMeeting));
      }
      ws.onclose = () => {
        console.log("WebSocket closed");
        resolve(); // ✅ Resolve the Promise once closed
      };

      ws.close(); // Trigger WebSocket closure
    });
  };

  // Expose `closeChatConnection` to parent using ref
  useImperativeHandle(ref, () => ({
    closeChatConnection,
  }));

  useEffect(() => {
    const messageContainer = messageContainerRef.current;
    if (!messageContainer) return;

    const handleScroll = () => {
      if (
        messageContainer.scrollTop === 0 &&
        !loadingHistory &&
        !allHistoryLoaded
      ) {
        fetchHistory();
      }
    };

    messageContainer.addEventListener("scroll", handleScroll);
    return () => messageContainer.removeEventListener("scroll", handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingHistory, allHistoryLoaded]);

  // useEffect(() => {
  //   console.log("messages updated:", messages);
  // }, [messages]);

  useEffect(() => {
    if (!email || !room || loading) {
      console.log("Missing email, room or loading");
      return;
    }

    console.log("WebSocket assigned:", ws);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log("WebSocket not ready");
      return;
    }

    const fetchInitialHistory = () => {
      if (ws.readyState === WebSocket.OPEN) {
        fetchHistory();
      } else {
        setTimeout(fetchInitialHistory, 100);
      }
    };

    fetchInitialHistory();

    ws.onopen = () => {
      console.log("WebSocket connected for room:", room);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("Message received:", message);

      switch (message.event) {
        case "message":
          setMessages((prev) => [...prev, message]);
          break;

        case "endmeeting":
          console.log("Meeting Ended");
          break;

        case "status":
          setParticipants((prev) =>
            prev.map((participant) =>
              participant.email === message.email
                ? { ...participant, status: message.status }
                : participant
            )
          );
          break;

        case "history":
          if (message.messages.length === 0) {
            setAllHistoryLoaded(true); // No more history to load
          } else {
            const earliestMessage =
              message.messages[message.messages.length - 1];
            const newCursor = earliestMessage.score; // Update cursor with the earliest message

            setMessages((prevMessages) => {
              const existingMessageIds = new Set(
                prevMessages.map((msg) => msg.messageId)
              );
              // console.log("Existing message IDs:", existingMessageIds);

              const newMessages = message.messages.filter(
                (msg: Message) => !existingMessageIds.has(msg.messageId)
              );
              // console.log("New messages:", newMessages);

              if (newMessages.length > 0) {
                setCursor(newCursor);
                return [...newMessages, ...prevMessages]; 
              }

              return prevMessages; // No change if no new messages
            });

            // Adjust scroll position properly
            const messageContainer = messageContainerRef.current;
            if (messageContainer) {
              const prevScrollHeight = messageContainer.scrollHeight;
              requestAnimationFrame(() => {
                if (messageContainer) {
                  messageContainer.scrollTop =
                    messageContainer.scrollHeight - prevScrollHeight;
                }
              });
            }
          }
          setLoadingHistory(false);
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

    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "ping",room, email }));
      }
    }, 60000);

    return () => {
      clearInterval(heartbeatInterval);
      console.log("Cleaning up WebSocket for room:", room);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, ws, email, loading]);

  const sendMessage = () => {
    if (ws && ws.readyState === WebSocket.OPEN && input.trim()) {
      const data = { action: "message", room, email, content: input.trim() };
      console.log("Sending message:", JSON.stringify(data));
      ws.send(JSON.stringify(data));
      setInput("");
    }
  };

  const fetchParticipants = async () => {
    try {
      const res = await axios.post(
        `${WS_BACKEND_URL}/api/v1/room/allparticipants`,
        { roomName: room },
        {
          headers: {
            Authorization: `${localStorage.getItem("token")}`,
          },
        }
      );
      const { host, participants } = res.data;

      setParticipants([host, ...participants]);
    } catch (error) {
      console.error("Error fetching participants:", error);
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
            onClick={() => {
              setActiveTab("Participants");
              fetchParticipants();
            }}
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

            {participants.map((participant, i) => (
              <div key={i} className="flex items-center gap-4 px-4">
                <div className="text-xs bg-white/5 backdrop-blur-sm text-white hover:bg-white/10 text-center w-8 h-8 border border-zinc-800 rounded-full flex items-center justify-center">
                  {participant.email
                    ? participant.email.charAt(0).toUpperCase()
                    : "U"}
                </div>
                <p className="">{participant.email}</p>
                <div
                  className={`w-2 h-2 rounded-full flex items-center justify-center ${
                    participant.status === "online"
                      ? "bg-green-500"
                      : "bg-gray-500"
                  }`}
                />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Messages Section */}
            <div
              ref={messageContainerRef}
              className="py-4 px-2 overflow-auto flex flex-col space-y-2 flex-1 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500 md:scrollbar-none"
              onScroll={(e) => {
                if (e.currentTarget.scrollTop === 0) {
                  fetchHistory();
                }
              }}
            >
              {loadingHistory && allHistoryLoaded && (
                <p className="text-center">Loading history...</p>
              )}
              {messages.map((msg, i) =>
                // ... (message rendering)
                msg.email === "System" ? (
                  <div key={i} className="">
                    <p className="text-xs text-gray-500/50 text-center bg-gray-700/50 px-2 rounded-md w-fit mx-auto">
                      {msg.content}
                    </p>
                  </div>
                ) : (
                  <div
                    key={i}
                    className={`flex items-start gap-2 ${
                      msg.email === email ? "justify-end" : "justify-start"
                    }`}
                  >
                    {/* ... (message content) */}
                    {/* Avatar */}
                    {msg.email !== email && (
                      <div className="text-xs bg-white/5 backdrop-blur-sm text-white hover:bg-white/10 text-center w-8 h-8 border border-zinc-800 rounded-full flex items-center justify-center">
                        {msg.email ? msg.email.charAt(0).toUpperCase() : "U"}
                      </div>
                    )}

                    {/* Message Box */}
                    <div
                      className={`py-2 px-4 rounded-lg max-w-xs w-fit break-words ${
                        msg.email === email
                          ? "bg-blue-500/70 hover:bg-blue-500/80 text-white ml-auto flex flex-row-reverse"
                          : "bg-white/5 backdrop-blur-sm text-white hover:bg-white/10"
                      } flex items-center gap-2`}
                    >
                      <div className="text-sm w-full">
                        <p
                          className={` mb-1 text-xs ${msg.email === email ? "text-end text-white/30" : "text-start text-white/15"}`}
                        >
                          {msg.email}
                        </p>
                        <p className="break-words w-full">{msg.content}</p>
                      </div>
                    </div>

                    {/* Avatar (for sent messages) */}
                    {msg.email === email && (
                      <div className="text-xs bg-white/5 backdrop-blur-sm text-white hover:bg-white/10 text-center w-8 h-8 border border-zinc-800 rounded-full flex items-center justify-center">
                        {msg.email ? msg.email.charAt(0).toUpperCase() : "U"}
                      </div>
                    )}
                  </div>
                )
              )}
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
});


Chat.displayName = "Chat";
export default Chat;