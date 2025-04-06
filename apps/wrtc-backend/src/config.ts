import os from 'os';
import { types } from 'mediasoup';
import dotenv from "dotenv";
dotenv.config();

const ifaces = os.networkInterfaces();

const getLocalIp = (): string => {
  let localIp = '127.0.0.1';
  Object.keys(ifaces).forEach((ifname) => {
    if(ifaces[ifname] === undefined){
      throw new Error("No network interfaces found");
    };
    for (const iface of ifaces[ifname]) {
      if (iface.family !== 'IPv4' || iface.internal !== false) {
        continue;
      }
      localIp = iface.address;
      return;
    }
  });
  return localIp;
};

export default {
  listenIp: '0.0.0.0',
  listenPort: Number(process.env.PORT) || 8080,
  mediasoup: {
    numWorkers: Math.max(os.cpus().length, 1),
    worker: {
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp']
    },
    router: {
      mediaCodecs: [
        {
          kind: 'audio' as types.MediaKind,
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2
        },
        {
          kind: 'video' as types.MediaKind,
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000
          }
        }
      ] as types.RtpCodecCapability[],
    },
    webRtcTransport: {
      listenIps: [
        {
          ip: '0.0.0.0',
          announcedIp: getLocalIp()
        }
      ],
      maxIncomingBitrate: 1500000,
      initialAvailableOutgoingBitrate: 1000000,
      enableUdp: true, // Enable UDP for better performance
      enableTcp: true, // Fallback to TCP
      preferUdp: true,
    },
  },
};