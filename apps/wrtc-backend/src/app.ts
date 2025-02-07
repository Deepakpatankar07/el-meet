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

  socket.on('join', ({ room_id, name }: { room_id: string; name: string }, callback: (response: any) => void) => {
    try {
      console.log('User joined:', { room_id, name });

      if (!roomList.has(room_id)) {
        return callback({ error: 'Room does not exist' });
      }

      const room = roomList.get(room_id);
      if (!room) {
        return callback({ error: 'Room not found' });
      }

      room.addPeer(new Peer(socket.id, name));
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

      console.log('Get producers:', { name: peer.name });

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

      console.log('Get RouterRtpCapabilities:', { name: peer.name });

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

      console.log('Create WebRTC transport:', { name: peer.name });

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

      console.log('Connect transport:', { name: peer.name });

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
        name: room.getPeers().get(socket.id)?.name,
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
        name: room.getPeers().get(socket.id)?.name,
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
      console.log('Disconnect:', { name: roomList.get(socket.room_id)?.getPeers().get(socket.id)?.name});

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
        name: roomList.get(socket.room_id)?.getPeers().get(socket.id)?.name,
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
        name: roomList.get(socket.room_id)?.getPeers().get(socket.id)?.name,
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




// socket.on("connectTransport", async ({ transport_id, dtlsParameters }: { transport_id: string; dtlsParameters: mediasoup.types.DtlsParameters }, callback: (response: string) => void) => {
//   if (!socket.room_id || !roomList.has(socket.room_id)) {
//     return callback('Room not found');
//   }
//   console.log("Connect transport", {
//     name: roomList.get(socket.room_id)?.getPeers().get(socket.id)?.name
//   });

//   await roomList.get(socket.room_id)!.connectPeerTransport(socket.id, transport_id, dtlsParameters);

//   callback("success");
// });

// import express from 'express';
// import http from 'http';
// import { Server } from 'socket.io';
// import fs from 'fs';
// import path from 'path';
// import * as mediasoup from 'mediasoup';
// import config from './config';
// import Room from './Room';
// import Peer from './Peer';

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server);

// app.use(express.static(path.join(__dirname, '..', 'public')));

// server.listen(config.listenPort, config.listenIp, () => {
//   console.log(`Server running on http://${config.listenIp}:${config.listenPort}`);
// });

// let workers: mediasoup.types.Worker[] = [];
// let nextMediasoupWorkerIdx = 0;
// let roomList = new Map<string, Room>();

// (async () => {
//   await createWorkers();
// })();

// async function createWorkers() {
//   let { numWorkers } = config.mediasoup;

//   for (let i = 0; i < numWorkers; i++) {
//     let worker = await mediasoup.createWorker({
//       logLevel: config.mediasoup.worker.logLevel as mediasoup.types.WorkerLogLevel,
//       logTags: config.mediasoup.worker.logTags as mediasoup.types.WorkerLogTag[],
//       rtcMinPort: config.mediasoup.worker.rtcMinPort,
//       rtcMaxPort: config.mediasoup.worker.rtcMaxPort
//     });

//     worker.on('died', () => {
//       console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
//       setTimeout(() => process.exit(1), 2000);
//     });
//     workers.push(worker);
//   }
// }

// io.on('connection', (socket) => {
//   socket.on('createRoom', async ({ room_id }, callback) => {
//     if (roomList.has(room_id)) {
//       callback('already exists');
//     } else {
//       console.log('Created room', { room_id: room_id });
//       let worker = await getMediasoupWorker();
//       roomList.set(room_id, new Room(room_id, worker, io));
//       callback(room_id);
//     }
//   });

//   // Other socket event handlers...
//   socket.on('join', ({ room_id, name }, cb) => {
//     console.log('User joined', {
//       room_id: room_id,
//       name: name
//     })

//     if (!roomList.has(room_id)) {
//       return cb({
//         error: 'Room does not exist'
//       })
//     }

//     roomList.get(room_id)?.addPeer(new Peer(socket.id, name))
//     socket.room_id = room_id

//     cb(roomList.get(room_id)?.toJson())
//   })

//   socket.on('getProducers', () => {
//     if (!roomList.has(socket.room_id)) return
//     console.log('Get producers', { name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}` })

//     // send all the current producer to newly joined member
//     let producerList = roomList.get(socket.room_id).getProducerListForPeer()

//     socket.emit('newProducers', producerList)
//   })

//   socket.on('getRouterRtpCapabilities', (_, callback) => {
//     console.log('Get RouterRtpCapabilities', {
//       name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}`
//     })

//     try {
//       callback(roomList.get(socket.room_id).getRtpCapabilities())
//     } catch (e) {
//       callback({
//         error: e.message
//       })
//     }
//   })

//   socket.on('createWebRtcTransport', async (_, callback) => {
//     console.log('Create webrtc transport', {
//       name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}`
//     })

//     try {
//       const { params } = await roomList.get(socket.room_id).createWebRtcTransport(socket.id)

//       callback(params)
//     } catch (err) {
//       console.error(err)
//       callback({
//         error: err.message
//       })
//     }
//   })

//   socket.on('connectTransport', async ({ transport_id, dtlsParameters }, callback) => {
//     console.log('Connect transport', { name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}` })

//     if (!roomList.has(socket.room_id)) return
//     await roomList.get(socket.room_id).connectPeerTransport(socket.id, transport_id, dtlsParameters)

//     callback('success')
//   })

//   socket.on('produce', async ({ kind, rtpParameters, producerTransportId }, callback) => {
//     if (!roomList.has(socket.room_id)) {
//       return callback({ error: 'not is a room' })
//     }

//     let producer_id = await roomList.get(socket.room_id).produce(socket.id, producerTransportId, rtpParameters, kind)

//     console.log('Produce', {
//       type: `${kind}`,
//       name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}`,
//       id: `${producer_id}`
//     })

//     callback({
//       producer_id
//     })
//   })

//   socket.on('consume', async ({ consumerTransportId, producerId, rtpCapabilities }, callback) => {
//     //TODO null handling
//     let params = await roomList.get(socket.room_id).consume(socket.id, consumerTransportId, producerId, rtpCapabilities)

//     console.log('Consuming', {
//       name: `${roomList.get(socket.room_id) && roomList.get(socket.room_id).getPeers().get(socket.id).name}`,
//       producer_id: `${producerId}`,
//       consumer_id: `${params.id}`
//     })

//     callback(params)
//   })

//   socket.on('resume', async (data, callback) => {
//     await consumer.resume()
//     callback()
//   })

//   socket.on('getMyRoomInfo', (_, cb) => {
//     cb(roomList.get(socket.room_id).toJson())
//   })

//   socket.on('disconnect', () => {
//     console.log('Disconnect', {
//       name: `${roomList.get(socket.room_id) && roomList.get(socket.room_id).getPeers().get(socket.id).name}`
//     })

//     if (!socket.room_id) return
//     roomList.get(socket.room_id).removePeer(socket.id)
//   })

//   socket.on('producerClosed', ({ producer_id }) => {
//     console.log('Producer close', {
//       name: `${roomList.get(socket.room_id) && roomList.get(socket.room_id).getPeers().get(socket.id).name}`
//     })

//     roomList.get(socket.room_id).closeProducer(socket.id, producer_id)
//   })

//   socket.on('exitRoom', async (_, callback) => {
//     console.log('Exit room', {
//       name: `${roomList.get(socket.room_id) && roomList.get(socket.room_id).getPeers().get(socket.id).name}`
//     })

//     if (!roomList.has(socket.room_id)) {
//       callback({
//         error: 'not currently in a room'
//       })
//       return
//     }
//     // close transports
//     await roomList.get(socket.room_id).removePeer(socket.id)
//     if (roomList.get(socket.room_id).getPeers().size === 0) {
//       roomList.delete(socket.room_id)
//     }

//     socket.room_id = null

//     callback('successfully exited room')
//   })
// })

// // TODO remove - never used?
// function room() {
//   return Object.values(roomList).map((r) => {
//     return {
//       router: r.router.id,
//       peers: Object.values(r.peers).map((p:any) => {
//         return {
//           name: p.name
//         }
//       }),
//       id: r.id
//     }
//   })
// }


// function getMediasoupWorker(): mediasoup.types.Worker {
//   const worker = workers[nextMediasoupWorkerIdx];

//   if (++nextMediasoupWorkerIdx === workers.length) nextMediasoupWorkerIdx = 0;

//   return worker;
// }