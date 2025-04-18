// "use client";

// import { useEffect, useRef, useState } from "react";
// import { useRouter } from "next/navigation";
// import RoomClient from "@/lib/RoomClient";
// import io, { Socket } from "socket.io-client";
// import * as mediasoupClient from "mediasoup-client";
// import { MdCallEnd } from "react-icons/md";
// import { PiCopySimple, PiDevicesDuotone } from "react-icons/pi";
// import {
//   LuCamera,
//   LuCameraOff,
//   LuMic,
//   LuMicOff,
//   LuScreenShare,
//   LuScreenShareOff,
//   LuVideo,
// } from "react-icons/lu";
// import { HiOutlineSpeakerWave } from "react-icons/hi2";
// import Logo from "@/components/Logo";
// import { VideoPlaceholder } from "@/components/VideoPlaceholder";
// import { useAppContext } from "@/context/AppContext";
// import Chat, { ChatRef } from "@/components/Chat";
// import NavPage from "@/components/NavPage";
// import { WRTC_BACKEND_URL } from "@/config";

// export default function VideoChat() {
//   const router = useRouter();
//   const { email, room: roomId, token: jwtToken } = useAppContext();

//   const [isLoading, setIsLoading] = useState(true);
//   const chatRef = useRef<ChatRef>(null);
//   const socketRef = useRef<Socket | null>(null);

//   const localMediaRef = useRef<HTMLDivElement>(null);
//   const remoteVideosRef = useRef<HTMLDivElement>(null);
//   const remoteAudiosRef = useRef<HTMLDivElement>(null);
//   const [roomClient, setRoomClient] = useState<RoomClient | null>(null);
//   const [isDevicesVisible, setIsDevicesVisible] = useState(false);
//   const [isVideoBtnVisible, setIsVideoBtnVisible] = useState(true);
//   const [isAudioBtnVisible, setIsAudioBtnVisible] = useState(true);
//   const [isScreenBtnVisible, setIsScreenBtnVisible] = useState(true);
//   const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
//   const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
//   const [localMediaElements, setLocalMediaElements] = useState<
//     (HTMLVideoElement | HTMLAudioElement)[]
//   >([]);
//   const [remoteMediaElements, setRemoteMediaElements] = useState<
//     (HTMLVideoElement | HTMLAudioElement)[]
//   >([]);

//   // Add this state at the top of your component
//   const [, setPermissionStatus] = useState<{
//     camera: PermissionState | null;
//     microphone: PermissionState | null;
//   }>({ camera: null, microphone: null });

//   // Check permissions for camera and microphone
//   const checkPermissions = async () => {
//     try {
//       const cameraPerm = await navigator.permissions.query({
//         name: "camera" as PermissionName,
//       });
//       const micPerm = await navigator.permissions.query({
//         name: "microphone" as PermissionName,
//       });

//       setPermissionStatus({
//         camera: cameraPerm.state,
//         microphone: micPerm.state,
//       });

//       // Listen for permission changes
//       cameraPerm.onchange = () =>
//         setPermissionStatus((prev) => ({ ...prev, camera: cameraPerm.state }));
//       micPerm.onchange = () =>
//         setPermissionStatus((prev) => ({ ...prev, microphone: micPerm.state }));

//       return { camera: cameraPerm.state, microphone: micPerm.state };
//     } catch (err) {
//       console.error("Error checking permissions:", err);
//       return { camera: null, microphone: null };
//     }
//   };

//   // Request media permissions and enumerate devices
//   const requestMediaPermissions = async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         audio: true,
//         video: true,
//       });
//       enumerateDevices();
//       stream.getTracks().forEach((track) => track.stop());
//       return true;
//     } catch (err) {
//       console.error("Error requesting media permissions:", err);
//       return false;
//     }
//   };

//   // Keep your enumerateDevices function as is (or enhance it slightly)
//   const enumerateDevices = () => {
//     navigator.mediaDevices
//       .enumerateDevices()
//       .then((devices) => {
//         setAudioDevices(
//           devices.filter((device) => device.kind === "audioinput")
//         );
//         setVideoDevices(
//           devices.filter((device) => device.kind === "videoinput")
//         );
//       })
//       .catch((err) => {
//         console.error("Error enumerating devices:", err);
//       });
//   };

//   // Combined initEnumerateDevices
//   const initEnumerateDevices = async () => {
//     const perms = await checkPermissions();

//     if (perms.camera === "denied" || perms.microphone === "denied") {
//       console.warn("Camera or microphone permissions denied.");
//       // Don’t proceed; let the user trigger it manually
//       return;
//     }

//     if (perms.camera === "granted" && perms.microphone === "granted") {
//       enumerateDevices();
//     } else {
//       // Prompt for permissions if not yet decided
//       const granted = await requestMediaPermissions();
//       if (!granted) {
//         console.warn("User denied media permissions.");
//       }
//     }
//   };

//   useEffect(() => {
//     if (!roomId || !email) return;

//     if (
//       localStorage.getItem("room") !== roomId ||
//       localStorage.getItem("email") !== email ||
//       localStorage.getItem("token") !== jwtToken
//     ) {
//       console.error("Room ID, email or token mismatch. Redirecting to login.");
//       router.push("/login"); // Redirect to login if no token is found
//       return;
//     }

//     console.log("Creating RoomClient instance");

//     const socketIO = io(`${WRTC_BACKEND_URL}`, {
//       auth: { token: jwtToken },
//       transports: ["websocket"],
//       reconnection: true, // Automatically try to reconnect
//       reconnectionAttempts: 5, // Retry 5 times before giving up
//       reconnectionDelay: 1000, // Wait 1 second between retries
//     });
//     socketRef.current = socketIO;
//     const socket = Object.assign(socketIO, {
//       request: (event: string, data?: any) => {
//         return new Promise((resolve, reject) => {
//           socketIO.emit(event, data, (response: any) => {
//             if (response?.error) reject(response.error);
//             else resolve(response);
//           });
//         });
//       },
//     });

//     initEnumerateDevices();

//     const rc = new RoomClient(
//       localMediaRef.current!,
//       remoteVideosRef.current!,
//       remoteAudiosRef.current!,
//       mediasoupClient,
//       socket,
//       roomId,
//       email,
//       () => {
//         console.log("Room opened");
//         setIsLoading(false);
//       },
//       (element) => {
//         setLocalMediaElements((prev) => [...prev, element]);
//       },
//       (elementId) => {
//         setLocalMediaElements((prev) =>
//           prev.filter((el) => el.id !== elementId)
//         );
//       },
//       (element) => {
//         setRemoteMediaElements((prev) => [...prev, element]);
//       },
//       (elementId) => {
//         setRemoteMediaElements((prev) =>
//           prev.filter((el) => el.id !== elementId)
//         );
//       }
//     );

//     setRoomClient(rc);

//     return () => {
//       console.log("Cleaning up RoomClient instance");
//       if (rc) {
//         rc.exit(); // Call exit only if rc exists
//       }
//       socketIO.disconnect();
//     };
//   }, [roomId, email, jwtToken, router]);



"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import RoomClient from "@/lib/RoomClient";
import io, { Socket } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import { MdCallEnd } from "react-icons/md";
import { PiCopySimple, PiDevicesDuotone } from "react-icons/pi";
import {
  LuCamera,
  LuCameraOff,
  LuMic,
  LuMicOff,
  LuScreenShare,
  LuScreenShareOff,
  LuVideo,
} from "react-icons/lu";
import { HiOutlineSpeakerWave } from "react-icons/hi2";
import Logo from "@/components/Logo";
import { VideoPlaceholder } from "@/components/VideoPlaceholder";
import { useAppContext } from "@/context/AppContext";
import Chat, { ChatRef } from "@/components/Chat";
import NavPage from "@/components/NavPage";
import { WRTC_BACKEND_URL } from "@/config";

interface SocketResponse {
  error?: string | Error; // Define the shape of the error property
  [key: string]: unknown; // Allow other properties
}

export default function VideoChat() {
  const router = useRouter();
  const { email, room: roomId, token: jwtToken } = useAppContext();

  const [isLoading, setIsLoading] = useState(true);
  const chatRef = useRef<ChatRef>(null);
  const socketRef = useRef<Socket | null>(null);

  const localMediaRef = useRef<HTMLDivElement>(null);
  const remoteVideosRef = useRef<HTMLDivElement>(null);
  const remoteAudiosRef = useRef<HTMLDivElement>(null);
  const [roomClient, setRoomClient] = useState<RoomClient | null>(null);
  const [isDevicesVisible, setIsDevicesVisible] = useState(false);
  const [isVideoBtnVisible, setIsVideoBtnVisible] = useState(true);
  const [isAudioBtnVisible, setIsAudioBtnVisible] = useState(true);
  const [isScreenBtnVisible, setIsScreenBtnVisible] = useState(true);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [localMediaElements, setLocalMediaElements] = useState<
    (HTMLVideoElement | HTMLAudioElement)[]
  >([]);
  const [remoteMediaElements, setRemoteMediaElements] = useState<
    (HTMLVideoElement | HTMLAudioElement)[]
  >([]);

  const checkPermissions = useCallback(async () => {
    try {
      const cameraPerm = await navigator.permissions.query({
        name: "camera" as PermissionName,
      });
      const micPerm = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });

      return { camera: cameraPerm.state, microphone: micPerm.state };
    } catch (err) {
      console.error("Error checking permissions:", err);
      return { camera: null, microphone: null };
    }
  }, []);

  const enumerateDevices = useCallback(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        setAudioDevices(devices.filter((device) => device.kind === "audioinput"));
        setVideoDevices(devices.filter((device) => device.kind === "videoinput"));
      })
      .catch((err) => {
        console.error("Error enumerating devices:", err);
      });
  }, []);

  const requestMediaPermissions = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      enumerateDevices();
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (err) {
      console.error("Error requesting media permissions:", err);
      return false;
    }
  }, [enumerateDevices]);

  const initEnumerateDevices = useCallback(async () => {
    const perms = await checkPermissions();

    if (perms.camera === "denied" || perms.microphone === "denied") {
      console.warn("Camera or microphone permissions denied.");
      return;
    }

    if (perms.camera === "granted" && perms.microphone === "granted") {
      enumerateDevices();
    } else {
      const granted = await requestMediaPermissions();
      if (!granted) {
        console.warn("User denied media permissions.");
      }
    }
  }, [checkPermissions, enumerateDevices, requestMediaPermissions]);

  useEffect(() => {
    if (!roomId || !email) return;

    if (
      localStorage.getItem("room") !== roomId ||
      localStorage.getItem("email") !== email ||
      localStorage.getItem("token") !== jwtToken
    ) {
      console.error("Room ID, email, or token mismatch. Redirecting to login.");
      router.push("/login");
      return;
    }

    console.log("Creating RoomClient instance");

    const socketIO = io(`${WRTC_BACKEND_URL}`, {
      auth: { token: jwtToken },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socketIO;
    const socket = Object.assign(socketIO, {
      request: (event: string, data?: unknown) => {
        return new Promise((resolve, reject) => {
          socketIO.emit(event, data, (response: SocketResponse) => {
            if (response?.error) {
              reject(response.error);
            } else {
              resolve(response);
            }
          });
        });
      },
    });

    initEnumerateDevices();

    const rc = new RoomClient(
      localMediaRef.current!,
      remoteVideosRef.current!,
      remoteAudiosRef.current!,
      mediasoupClient,
      socket,
      roomId,
      email,
      () => {
        console.log("Room opened");
        setIsLoading(false);
      },
      (element) => {
        setLocalMediaElements((prev) => [...prev, element]);
      },
      (elementId) => {
        setLocalMediaElements((prev) => prev.filter((el) => el.id !== elementId));
      },
      (element) => {
        setRemoteMediaElements((prev) => [...prev, element]);
      },
      (elementId) => {
        setRemoteMediaElements((prev) => prev.filter((el) => el.id !== elementId));
      }
    );

    setRoomClient(rc);

    return () => {
      console.log("Cleaning up RoomClient instance");
      if (rc) {
        rc.exit();
      }
      socketIO.disconnect();
    };
  }, [roomId, email, jwtToken, router, initEnumerateDevices]);

  const handleExit = async () => {
    const confirmExit = window.confirm(
      "Are you sure you want to end the meeting?"
    );
    if (!confirmExit) return;

    if (chatRef.current) {
      await chatRef.current.closeChatConnection(); // Wait for WebSocket to close
    }

    if (roomClient) {
      roomClient.exit(); // Call exit only once here
      setRoomClient(null); // Clear roomClient to prevent double cleanup
    }
    socketRef.current?.disconnect();

    localStorage.removeItem("room");
    localStorage.removeItem("email");
    localStorage.removeItem("isHost");

    console.log("redirecting to /");
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen transition">
        <NavPage />
        <div className="bg-zinc-800/20 backdrop-blur-sm py-[43px] w-full" />
        <div className="flex items-center justify-center h-4/5">
          <h3 className="text-red-500 text-center ">Loading....</h3>
        </div>
      </div>
    );
  }

  const handleFullscreen = async (element: HTMLVideoElement) => {
    try {
      if (!document.fullscreenElement) {
        await element.requestFullscreen();
        element.style.pointerEvents = "none";
      } else {
        await document.exitFullscreen();
        element.style.pointerEvents = "auto";
      }
    } catch (error) {
      console.error("Fullscreen request failed:", error);
    }
  };

  return (
    <div className="w-full min-h-screen bg-neutral-700/50 text-white flex flex-col items-center justify-start transition">
      <main className="flex flex-col items-center justify-start w-full min-h-screen bg-background p-4">
        <div className="flex justify-between items-center w-full rounded-xl px-4">
          <div className="px-4">
            <div className="text-white text-xl">
              {"< "}Welcome to El-Meet,{" "}
              <span className="text-red-500">{email}</span> !
            </div>
          </div>
          <div>
            <Logo isLogoName={false} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-7xl min-h-[75vh] rounded-md">
          <div className="md:col-span-2 px-4 pb-4 flex-1 rounded-xl">
            {/* Controllers */}

            <div className="container  rounded-lg shadow-lg">
              <div id="videoMedia" className="flex flex-col mb-4">
                {/* <h4 className="px-4 py-2"> Local media </h4> */}
                <div
                  id="localMedia"
                  className="containers relative"
                  ref={localMediaRef}
                >
                  <div
                    id="control"
                    className="absolute bottom-0 z-50 w-full flex gap-6 items-center justify-center px-4 py-2 rounded-lg shadow-lg"
                  >
                    <br />
                    {[
                      {
                        id: "exitButton",
                        icon: <MdCallEnd className="text-2xl" />,
                        label: "End Meeting",
                        className: "px-8 bg-red-600/90 hover:bg-red-600/80",
                        onClick: handleExit,
                      },
                      {
                        id: "copyButton",
                        icon: <PiCopySimple className="text-2xl" />,
                        label: "Copy URL",
                        className: " bg-white/5 hover:bg-white/10",
                        onClick: () => roomClient?.copyURL(),
                      },
                      {
                        id: "devicesButton",
                        icon: <PiDevicesDuotone className="text-2xl" />,
                        label: "Devices",
                        className: " bg-white/5 hover:bg-white/10",
                        onClick: () => setIsDevicesVisible(!isDevicesVisible),
                      },
                    ].map(({ id, icon, label, className, onClick }) => (
                      <button
                        key={id}
                        id={id}
                        onClick={onClick}
                        className={`group relative flex items-center justify-center backdrop-blur-sm text-white p-3 rounded-full transition-all shadow-md ${className}`}
                      >
                        {icon}
                        <span className="absolute top-full min-w-fit text-nowrap mt-1 px-4 py-2 text-xs bg-zinc-900 text-white rounded-md hidden group-hover:inline-block transition">
                          {label}
                        </span>
                      </button>
                    ))}

                    {isAudioBtnVisible ? (
                      <button
                        className="group relative flex items-center justify-center bg-white/5 backdrop-blur-sm text-white hover:bg-white/10 p-3 rounded-full transition-all shadow-md"
                        id="startAudioButton"
                        onClick={() => {
                          roomClient?.produce(
                            RoomClient.mediaType.audio,
                            "default"
                          );
                          setIsAudioBtnVisible(false);
                        }}
                      >
                        <LuMic className="text-2xl" />
                        <span className="absolute top-full min-w-fit text-nowrap mt-1 px-4 py-2 text-xs bg-zinc-900 text-white rounded-md hidden group-hover:inline-block transition">
                          Open audio
                        </span>
                      </button>
                    ) : (
                      <button
                        className="group relative flex items-center justify-center bg-white/5 backdrop-blur-sm text-white hover:bg-white/10 p-3 rounded-full transition-all shadow-md"
                        id="stopAudioButton"
                        onClick={() => {
                          roomClient?.closeProducer(RoomClient.mediaType.audio);
                          setIsAudioBtnVisible(true);
                        }}
                      >
                        <LuMicOff className="text-2xl" />
                        <span className="absolute top-full min-w-fit text-nowrap mt-1 px-4 py-2 text-xs bg-zinc-900 text-white rounded hidden group-hover:inline-block transition">
                          Close audio
                        </span>
                      </button>
                    )}
                    {isVideoBtnVisible ? (
                      <button
                        className="group relative flex items-center justify-center bg-white/5 backdrop-blur-sm text-white hover:bg-white/10 p-3 rounded-full transition-all shadow-md"
                        id="startVideoButton"
                        onClick={() => {
                          roomClient?.produce(
                            RoomClient.mediaType.video,
                            "default"
                          );
                          setIsVideoBtnVisible(false);
                        }}
                      >
                        <LuCamera className="text-2xl" />
                        <span className="absolute top-full min-w-fit text-nowrap mt-1 px-4 py-2 text-xs bg-zinc-900 text-white rounded hidden group-hover:inline-block transition">
                          Open video
                        </span>
                      </button>
                    ) : (
                      <button
                        className="group relative flex items-center justify-center bg-white/5 backdrop-blur-sm text-white hover:bg-white/10 p-3 rounded-full transition-all shadow-md"
                        id="stopVideoButton"
                        onClick={() => {
                          roomClient?.closeProducer(RoomClient.mediaType.video);
                          setIsVideoBtnVisible(true);
                        }}
                      >
                        <LuCameraOff className="text-2xl" />
                        <span className="absolute top-full min-w-fit text-nowrap mt-1 px-4 py-2 text-xs bg-zinc-900 text-white rounded hidden group-hover:inline-block transition">
                          Close video
                        </span>
                      </button>
                    )}
                    {isScreenBtnVisible ? (
                      <button
                        className="group relative flex items-center justify-center bg-white/5 backdrop-blur-sm text-white hover:bg-white/10 p-3 rounded-full transition-all shadow-md"
                        id="startScreenButton"
                        onClick={() => {
                          roomClient?.produce(RoomClient.mediaType.screen);
                          setIsScreenBtnVisible(false);
                        }}
                      >
                        <LuScreenShare className="text-2xl" />
                        <span className="absolute top-full min-w-fit text-nowrap mt-1 px-4 py-2 text-xs bg-zinc-900 text-white rounded hidden group-hover:inline-block transition">
                          Open screen
                        </span>
                      </button>
                    ) : (
                      <button
                        className="group relative flex items-center justify-center bg-white/5 backdrop-blur-sm text-white hover:bg-white/10 p-3 rounded-full transition-all shadow-md"
                        id="stopScreenButton"
                        onClick={() => {
                          roomClient?.closeProducer(
                            RoomClient.mediaType.screen
                          );
                          setIsScreenBtnVisible(true);
                        }}
                      >
                        <LuScreenShareOff className="text-2xl" />
                        <span className="absolute top-full min-w-fit text-nowrap mt-1 px-4 py-2 text-xs bg-zinc-900 text-white rounded hidden group-hover:inline-block transition">
                          Close screen
                        </span>
                      </button>
                    )}
                  </div>

                  <>
                    {localMediaElements.length === 0 ? (
                      <div className="containers mt-4 h-[70vh] w-full relative bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl flex items-center justify-center overflow-hidden">
                        <VideoPlaceholder />
                      </div>
                    ) : (
                      localMediaElements.map((element) => (
                        <div
                          key={element.id}
                          className="containers mt-4 max-h-fit h-fit w-full relative bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl flex items-center justify-center overflow-hidden"
                          onClick={() =>
                            handleFullscreen(element as HTMLVideoElement)
                          }
                          ref={(node) => {
                            if (node && !node.hasChildNodes()) {
                              element.style.transform = "scaleX(-1)";
                              element.style.objectFit = "cover";
                              node.appendChild(element);
                            }
                          }}
                        ></div>
                      ))
                    )}
                  </>
                </div>
                {/* Device Selector */}
                <div
                  id="devicesList"
                  className={isDevicesVisible ? "" : "hidden"}
                >
                  <div className="flex flex-col gap-2 mt-8">
                    <div className="flex gap-4 items-center">
                      <div className="flex items-center gap-1 border border-zinc-800 px-6 py-2 rounded-xl">
                        <HiOutlineSpeakerWave className="text-xl" />
                      </div>
                      <div className="bg-transparent border border-zinc-800 px-4 py-1.5 rounded-xl">
                        <select
                          id="audioSelect"
                          className="form-select bg-transparent text-white/80 focus:outline-none outline-none"
                          style={{ width: "auto" }}
                        >
                          {audioDevices.map((device) => (
                            <option
                              key={device.deviceId}
                              value={device.deviceId}
                              className=" bg-black text-white/80"
                            >
                              {device.label ||
                                `Audio Device ${device.deviceId}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {/* <br /> */}
                    <div className="flex gap-4 items-center">
                      <div className="flex items-center gap-1 border border-zinc-800 px-6 py-2 rounded-xl">
                        <LuVideo className="text-xl" />
                      </div>
                      <div className="bg-transparent border border-zinc-800 px-4 py-1.5 rounded-xl">
                        <select
                          id="videoSelect"
                          className="form-select bg-transparent text-white/80 focus:outline-none outline-none"
                          style={{ width: "auto" }}
                        >
                          {videoDevices.map((device) => (
                            <option
                              key={device.deviceId}
                              value={device.deviceId}
                              className=" bg-black text-white/80"
                            >
                              {device.label ||
                                `Video Device ${device.deviceId}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                <br />
                <>
                  <h4 className="px-4 py-2 mb-3"> Participants video </h4>
                  {remoteMediaElements.length === 0 ? (
                    <div className="containers min-h-fit h-fit w-full gap-2 p-1 relative bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl flex items-center justify-center text-white/50">
                      No participants
                    </div>
                  ) : (
                    <>
                      <div
                        id="remoteVideos"
                        className="containers min-h-fit h-fit w-full relative bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl flex flex-wrap justify-center gap-2 overflow-auto p-2"
                        ref={remoteVideosRef}
                      >
                        {remoteMediaElements
                          .filter(
                            (element) => element instanceof HTMLVideoElement
                          )
                          .map((element) => (
                            <div
                              key={element.id}
                              className="w-[32%] aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center"
                              ref={(node) => {
                                if (node) {
                                  node.innerHTML = "";
                                  node.appendChild(element);
                                }
                              }}
                            ></div>
                          ))}
                      </div>
                    </>
                  )}

                  <div id="remoteAudios" ref={remoteAudiosRef}>
                    {remoteMediaElements
                      .filter((element) => element instanceof HTMLAudioElement)
                      .map((element) => (
                        <div
                          key={element.id}
                          ref={(node) => {
                            if (node) {
                              node.innerHTML = "";
                              node.appendChild(element);
                            }
                          }}
                        ></div>
                      ))}
                  </div>
                </>
              </div>
            </div>
          </div>
          <div className="bg-background border border-zinc-800 rounded-xl shadow-xl mt-4 flex-1 overflow-hidden h-[87vh]">
            <div>
              <Chat ref={chatRef} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
