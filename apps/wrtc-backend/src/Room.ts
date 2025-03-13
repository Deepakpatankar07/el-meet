import config from './config';
import mediasoup from 'mediasoup';
import Peer from './Peer';

export default class Room {
  id: string;
  router: mediasoup.types.Router | null = null;
  peers: Map<string, Peer> = new Map();
  io: any;

  constructor(room_id: string, worker: mediasoup.types.Worker, io: any) {
    this.id = room_id;
    this.io = io;
    this.initializeRouter(worker).catch((err) => console.error(`Router initialization failed for room ${room_id}`, err));
  }

  private async initializeRouter(worker: mediasoup.types.Worker): Promise<void> {
    try {
      const mediaCodecs = config.mediasoup.router.mediaCodecs;
      if(!worker || !mediaCodecs) {
        throw new Error('Worker or mediaCodecs not found');
      }
      this.router = await worker.createRouter({ mediaCodecs });
      console.log(`Router created for room ${this.id}`);
    } catch (error) {
      console.error(`Failed to create router for room ${this.id}:`, error);
      throw error;
    }
  }

  addPeer(peer: Peer): void {
    this.peers.set(peer.id, peer);
    console.log(`Peer ${peer.id} added to room ${this.id}`);
  }

  getProducerListForPeer(): { producer_id: string }[] {
    const producerList: { producer_id: string }[] = [];
    this.peers.forEach((peer) => {
      peer.producers.forEach((producer) => {
        producerList.push({ producer_id: producer.id });
      });
    });
    return producerList;
  }

  getRtpCapabilities(): mediasoup.types.RtpCapabilities {
    if (!this.router) {
      throw new Error('Router not initialized');
    }
    return this.router.rtpCapabilities;
  }

  async createWebRtcTransport(socket_id: string): Promise<{
    params: {
      id: string;
      iceParameters: mediasoup.types.IceParameters;
      iceCandidates: mediasoup.types.IceCandidate[];
      dtlsParameters: mediasoup.types.DtlsParameters;
    };
  }> {
    if (!this.router) {
      throw new Error('Router not initialized');
    }

    const { maxIncomingBitrate, initialAvailableOutgoingBitrate } = config.mediasoup.webRtcTransport;

    const transport = await this.router.createWebRtcTransport({
      listenIps: config.mediasoup.webRtcTransport.listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate,
    }).catch((err) => {
      console.error(`Failed to create WebRTC transport for ${socket_id}`, err);
      throw err;
    });

    if (maxIncomingBitrate) {
      try {
        await transport.setMaxIncomingBitrate(maxIncomingBitrate);
      } catch (error) {
        console.error('Failed to set max incoming bitrate:', error);
      }
    }

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        console.log('Transport closed', { email: this.peers.get(socket_id)?.email });
        transport.close();
      }
    });

    transport.on('@close', () => {
      console.log('Transport closed', { email: this.peers.get(socket_id)?.email });
    });

    console.log("socket Id:", socket_id,'Adding transport', { transportId: transport.id });
    this.peers.get(socket_id)?.addTransport(transport);

    return {
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    };
  }

  async connectPeerTransport(socket_id: string, transport_id: string, dtlsParameters: mediasoup.types.DtlsParameters): Promise<void> {
    const peer = this.peers.get(socket_id);
    if (!peer) {
      console.error(`Peer ${socket_id} not found`);
      return;
    }
    await peer.connectTransport(transport_id, dtlsParameters);
  }

  async produce(socket_id: string, producerTransportId: string, rtpParameters: mediasoup.types.RtpParameters, kind: string): Promise<string> {
    const peer = this.peers.get(socket_id);
    if (!peer) {
      throw new Error(`Peer ${socket_id} not found`);
    }

    const producer = await peer.createProducer(producerTransportId, rtpParameters, kind);
    if(!producer) {
        throw new Error('Producer is null');
        }
    this.broadCast(socket_id, 'newProducers', [
      {
        producer_id: producer.id,
        producer_socket_id: socket_id,
      },
    ]);

    return producer.id;
  }

  async consume(socket_id: string, consumer_transport_id: string, producer_id: string, rtpCapabilities: mediasoup.types.RtpCapabilities): Promise<{ producerId: string; id: string; kind: mediasoup.types.MediaKind; rtpParameters: mediasoup.types.RtpParameters; type: mediasoup.types.ConsumerType; producerPaused: boolean } | undefined>{
    if (!this.router || !this.router.canConsume({ producerId: producer_id, rtpCapabilities })) {
      console.error('Cannot consume');
      return;
    }

    const peer = this.peers.get(socket_id);
    if (!peer) {
      console.error(`Peer ${socket_id} not found`);
      return;
    }

    const result = await peer.createConsumer(consumer_transport_id, producer_id, rtpCapabilities);

    if (!result) {
        console.error('Failed to create consumer');
        return;
    }
  
    const { consumer, params } = result;
    consumer.on('producerclose', () => {
      console.log('Consumer closed due to producerclose event', {
        email: peer.email,
        consumer_id: consumer.id,
      });
      peer.removeConsumer(consumer.id);
      this.io.to(socket_id).emit('consumerClosed', {
        consumer_id: consumer.id,
      });
    });

    return params;
  }

  async removePeer(socket_id: string): Promise<void> {
    const peer = this.peers.get(socket_id);
    if (peer) {
      peer.close();
      this.peers.delete(socket_id);
      console.log(`Peer ${socket_id} removed from room ${this.id}`);
    }
  }

  closeProducer(socket_id: string, producer_id: string): void {
    this.peers.get(socket_id)?.closeProducer(producer_id);
  }

  broadCast(socket_id: string, email: string, data: any): void {
    Array.from(this.peers.keys())
      .filter((id) => id !== socket_id)
      .forEach((otherID) => this.send(otherID, email, data));
  }

  send(socket_id: string, email: string, data: any): void {
    this.io.to(socket_id).emit(email, data);
  }

  getPeers(): Map<string, Peer> {
    return this.peers;
  }

  toJson(): { id: string; peers: string } {
    return {
      id: this.id,
      peers: JSON.stringify([...this.peers]),
    };
  }
}