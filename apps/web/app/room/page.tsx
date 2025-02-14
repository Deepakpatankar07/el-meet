"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import RoomClient from "@/lib/RoomClient";
import io from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import { MdCallEnd } from "react-icons/md";
import { PiCopySimple, PiDevicesDuotone } from "react-icons/pi";
import { LuCamera, LuCameraOff, LuMic, LuMicOff, LuScreenShare, LuScreenShareOff, LuVideo } from "react-icons/lu";
import { HiOutlineSpeakerWave } from "react-icons/hi2";
import Logo from "@/components/Logo";
import { VideoPlaceholder } from "@/components/VideoPlaceholder";
import { useAppContext } from "@/context/AppContext";
import Chat from "@/components/Chat";

export default function VideoChat() {
  const { name, room:roomId } = useAppContext()
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    if (!roomId || !name) return;

    console.log("Creating RoomClient instance");

    const socketIO = io("http://localhost:3010");
    const socket = Object.assign(socketIO, {
      request: (event: string, data?: any) => {
        return new Promise((resolve, reject) => {
          socketIO.emit(event, data, (response: any) => {
            if (response?.error) reject(response.error);
            else resolve(response);
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
      name,
      () => {
        console.log("Room opened");
        setIsLoading(false);
      },
      (element) => {
        setLocalMediaElements((prev) => [...prev, element]);
      },
      (elementId) => {
        setLocalMediaElements((prev) =>
          prev.filter((el) => el.id !== elementId)
        );
      },
      (element) => {
        setRemoteMediaElements((prev) => [...prev, element]);
      },
      (elementId) => {
        setRemoteMediaElements((prev) =>
          prev.filter((el) => el.id !== elementId)
        );
      }
    );

    setRoomClient(rc);

    return () => {
      console.log("Cleaning up RoomClient instance");
      rc.exit();
      socketIO.disconnect();
    };
  }, [roomId, name]);

  const initEnumerateDevices = () => {
    const constraints = { audio: true, video: true };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        enumerateDevices();
        stream.getTracks().forEach((track) => track.stop());
      })
      .catch((err) => {
        console.error("Access denied for audio/video: ", err);
      });
  };

  const enumerateDevices = () => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      console.log("Devices:", devices);
      setAudioDevices(devices.filter((device) => device.kind === "audioinput"));
      setVideoDevices(devices.filter((device) => device.kind === "videoinput"));
    });
  };

  if (!roomId || !name) {
    return (
      <h3 className="text-red-500 text-center mt-8">Error: Missing room ID or name. Please go back and enter details.</h3>
    );
  }

  if (isLoading) {
    return (
      <h3 className="text-red-500 text-center mt-8">Loading....</h3>
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
    <div className="w-full min-h-screen bg-neutral-700/50 text-white flex flex-col items-center justify-start">
      <main className="flex flex-col items-center justify-start w-full min-h-screen bg-background p-4">
        <div className="flex justify-between items-center w-full rounded-xl px-4">
          <div className="px-4">
            <div className="text-white text-xl">
              {"< "}Welcome to the meet, <span className="text-red-500">{name}</span> !
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
                        icon: (
                          <MdCallEnd className="text-2xl" />
                        ),
                        label: "End Meeting",
                        className: "px-8 bg-red-600/90 hover:bg-red-600/80",
                        onClick: () => roomClient?.exit(),
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
                        roomClient?.produce(RoomClient.mediaType.audio, "default");
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
                <h4 className="px-4 py-2"> Participants video </h4>
                <div
                    id="remoteVideos"
                    className="containers min-h-fit h-fit w-full relative bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl flex flex-wrap justify-center gap-2 overflow-auto p-2"
                    ref={remoteVideosRef}
                  >
                    {remoteMediaElements
                      .filter((element) => element instanceof HTMLVideoElement)
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
              <Chat />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}



