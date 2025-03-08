import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import * as mediasoup from 'mediasoup';
import config from './config';
import Room from './Room';
import Peer from './Peer';
import cors from "cors";

const app = express();
app.use(cors({ origin: "*", credentials: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", credentials: true } });

server.listen(config.listenPort, config.listenIp, () => {
  console.log(`Server running on http://${config.listenIp}:${config.listenPort}`);
});

// All mediasoup workers
let workers: mediasoup.types.Worker[] = [];
let nextMediasoupWorkerIdx = 0;

// Map to store rooms
let roomList: Map<string, Room> = new Map();

interface CustomSocket extends Socket {
    room_id?: string|null;
  }

// Initialize mediasoup workers
(async () => {
  await createWorkers();
})();

async function createWorkers(): Promise<void> {
  const { numWorkers } = config.mediasoup;

  for (let i = 0; i < numWorkers; i++) {
    try {
      const worker = await mediasoup.createWorker({
        logLevel: config.mediasoup.worker.logLevel as mediasoup.types.WorkerLogLevel,
        logTags: config.mediasoup.worker.logTags as mediasoup.types.WorkerLogTag[],
        rtcMinPort: config.mediasoup.worker.rtcMinPort,
        rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
      });

      worker.on('died', () => {
        console.error('Mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
        setTimeout(() => process.exit(1), 2000);
      });

      workers.push(worker);
    } catch (error : any) {
      console.error('Failed to create mediasoup worker:', error);
      throw error;
    }
  }
}

io.on('connection', (socket:CustomSocket) => {
  console.log('New connection:', socket.id);

  socket.on('createRoom', async ({ room_id }: { room_id: string }, callback: (response: string | { error: string }) => void) => {
    try {
      if (roomList.has(room_id)) {
        callback('already exists');
      } else {
        const worker = getMediasoupWorker();
        roomList.set(room_id, new Room(room_id, worker, io));
        console.log('Created room:', { room_id });
        callback(room_id);
      }
    } catch (error : any) {
      console.error('Error creating room:', error);
      callback({ error: 'Failed to create room' });
    }
  });

  socket.on('join', ({ room_id, email }: { room_id: string; email: string }, callback: (response: any) => void) => {
    try {
      console.log('User joined:', { room_id, email });

      if (!roomList.has(room_id)) {
        return callback({ error: 'Room does not exist' });
      }

      const room = roomList.get(room_id);
      if (!room) {
        return callback({ error: 'Room not found' });
      }

      room.addPeer(new Peer(socket.id, email));
      socket.room_id = room_id;

      callback(room.toJson());
    } catch (error : any) {
      console.error('Error joining room:', error);
      callback({ error: 'Failed to join room' });
    }
  });

  socket.on('getProducers', () => {
    try {
      if (!socket.room_id || !roomList.has(socket.room_id)) return;

      const room = roomList.get(socket.room_id);
      if (!room) return;

      const peer = room.getPeers().get(socket.id);
      if (!peer) return;

      console.log('Get producers:', { email: peer.email });

      const producerList = room.getProducerListForPeer();
      socket.emit('newProducers', producerList);
    } catch (error : any) {
      console.error('Error getting producers:', error);
    }
  });

  socket.on('getRouterRtpCapabilities', (_, callback: (response: any) => void) => {
    try {
      if (!socket.room_id || !roomList.has(socket.room_id)) {
        return callback({ error: 'Room not found' });
      }

      const room = roomList.get(socket.room_id);
      if (!room) {
        return callback({ error: 'Room not found' });
      }

      const peer = room.getPeers().get(socket.id);
      if (!peer) {
        return callback({ error: 'Peer not found' });
      }

      console.log('Get RouterRtpCapabilities:', { email: peer.email });

      const rtpCapabilities = room.getRtpCapabilities();
      callback(rtpCapabilities);
    } catch (error : any) {
      console.error('Error getting router RTP capabilities:', error);
      callback({ error: error.message });
    }
  });

  socket.on('createWebRtcTransport', async (_, callback: (response: any) => void) => {
    try {
      if (!socket.room_id || !roomList.has(socket.room_id)) {
        return callback({ error: 'Room not found' });
      }

      const room = roomList.get(socket.room_id);
      if (!room) {
        return callback({ error: 'Room not found' });
      }

      const peer = room.getPeers().get(socket.id);
      if (!peer) {
        return callback({ error: 'Peer not found' });
      }

      console.log('Create WebRTC transport:', { email: peer.email });

      const { params } = await room.createWebRtcTransport(socket.id);
      callback(params);
    } catch (error : any) {
      console.error('Error creating WebRTC transport:', error);
      callback({ error: error.message });
    }
  });

  socket.on('connectTransport', async ({ transport_id, dtlsParameters }: { transport_id: string; dtlsParameters: mediasoup.types.DtlsParameters }, callback: (response: string) => void) => {
    try {
      if (!socket.room_id || !roomList.has(socket.room_id)) {
        return callback('Room not found');
      }

      const room = roomList.get(socket.room_id);
      if (!room) {
        return callback('Room not found');
      }

      const peer = room.getPeers().get(socket.id);
      if (!peer) {
        return callback('Peer not found');
      }

      console.log('Connect transport:', { email: peer.email });

      await room.connectPeerTransport(socket.id, transport_id, dtlsParameters);
      callback('success');
    } catch (error : any) {
      console.error('Error connecting transport:', error);
      callback('Failed to connect transport');
    }
  });

  socket.on('produce', async ({ kind, rtpParameters, producerTransportId }: { kind: string; rtpParameters: mediasoup.types.RtpParameters; producerTransportId: string }, callback: (response: any) => void) => {
    try {
      if (!socket.room_id || !roomList.has(socket.room_id)) {
        return callback({ error: 'Not in a room' });
      }

      const room = roomList.get(socket.room_id);
      if (!room) {
        return callback({ error: 'Room not found' });
      }

      const producer_id = await room.produce(socket.id, producerTransportId, rtpParameters, kind);

      console.log('Produce:', {
        type: kind,
        email: room.getPeers().get(socket.id)?.email,
        id: producer_id,
      });

      callback({ producer_id });
    } catch (error : any) {
      console.error('Error producing:', error);
      callback({ error: error.message });
    }
  });

  socket.on('consume', async ({ consumerTransportId, producerId, rtpCapabilities }: { consumerTransportId: string; producerId: string; rtpCapabilities: mediasoup.types.RtpCapabilities }, callback: (response: any) => void) => {
    try {
      if (!socket.room_id || !roomList.has(socket.room_id)) {
        return callback({ error: 'Room not found' });
      }

      const room = roomList.get(socket.room_id);
      if (!room) {
        return callback({ error: 'Room not found' });
      }

      const params = await room.consume(socket.id, consumerTransportId, producerId, rtpCapabilities);

      if(!params) {
            return callback({ error: 'Failed to consume' });
}
      console.log('Consuming:', {
        email: room.getPeers().get(socket.id)?.email,
        producer_id: producerId,
        consumer_id: params.id,
      });

      callback(params);
    } catch (error : any) {
      console.error('Error consuming:', error);
      callback({ error: error.message });
    }
  });

  socket.on('resume', async (_, callback: () => void) => {
    try {
      // TODO: Implement consumer resume logic
      callback();
    } catch (error : any) {
      console.error('Error resuming consumer:', error);
      callback();
    }
  });

  socket.on('getMyRoomInfo', (_, callback: (response: any) => void) => {
    try {
      if (!socket.room_id || !roomList.has(socket.room_id)) {
        return callback({ error: 'Room not found' });
      }

      const room = roomList.get(socket.room_id);
      if (!room) {
        return callback({ error: 'Room not found' });
      }

      callback(room.toJson());
    } catch (error : any) {
      console.error('Error getting room info:', error);
      callback({ error: error.message });
    }
  });

  socket.on('disconnect', () => {
      try {
        if(!socket.room_id){
            throw new Error("Socket room id not present !!");
        }
      console.log('Disconnect:', { email: roomList.get(socket.room_id)?.getPeers().get(socket.id)?.email});

      const room = roomList.get(socket.room_id);
      if (!room) return;

      room.removePeer(socket.id);
    } catch (error : any) {
      console.error('Error handling disconnect:', error);
    }
  });

  socket.on('producerClosed', ({ producer_id }: { producer_id: string }) => {
      try {
        if(!socket.room_id){
            throw new Error("Socket room id not present !!");
        }
      console.log('Producer close:', {
        email: roomList.get(socket.room_id)?.getPeers().get(socket.id)?.email,
      });

      if (!socket.room_id) return;

      const room = roomList.get(socket.room_id);
      if (!room) return;

      room.closeProducer(socket.id, producer_id);
    } catch (error : any) {
      console.error('Error closing producer:', error);
    }
  });

  socket.on('exitRoom', async (_, callback: (response: any) => void) => {
    try {
        if(!socket.room_id){
            throw new Error("Socket room id not present !!");
        }
      console.log('Exit room:', {
        email: roomList.get(socket.room_id)?.getPeers().get(socket.id)?.email,
      });

      if (!socket.room_id || !roomList.has(socket.room_id)) {
        return callback({ error: 'Not currently in a room' });
      }

      const room = roomList.get(socket.room_id);
      if (!room) {
        return callback({ error: 'Room not found' });
      }

      await room.removePeer(socket.id);

      if (room.getPeers().size === 0) {
        roomList.delete(socket.room_id);
      }

      socket.room_id = null;
      callback('successfully exited room');
    } catch (error : any) {
      console.error('Error exiting room:', error);
      callback({ error: error.message });
    }
  });
});

// Get next mediasoup worker
function getMediasoupWorker(): mediasoup.types.Worker {
  const worker = workers[nextMediasoupWorkerIdx];

  if (++nextMediasoupWorkerIdx === workers.length) nextMediasoupWorkerIdx = 0;

  return worker;
}
