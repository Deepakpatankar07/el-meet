import { EventEmitter } from 'events';
import { ProducerOptions } from 'mediasoup-client/lib/types';


const mediaType = {
  audio: 'audio',
  video: 'video',
  screen: 'screen',
} as const;

// type MediaType = keyof typeof mediaType;

type EventTypes =
  | 'exitRoom'
  | 'openRoom'
  | 'startVideo'
  | 'stopVideo'
  | 'startAudio'
  | 'stopAudio'
  | 'startScreen'
  | 'stopScreen';

const _EVENTS: Record<EventTypes, EventTypes> = {
  exitRoom: 'exitRoom',
  openRoom: 'openRoom',
  startVideo: 'startVideo',
  stopVideo: 'stopVideo',
  startAudio: 'startAudio',
  stopAudio: 'stopAudio',
  startScreen: 'startScreen',
  stopScreen: 'stopScreen',
};


interface Socket {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request(event: string, payload?: any): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(event: string, payload?: any): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, callback: (data: any) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(event: string, callback?: (data: any) => void): void;
}

interface MediasoupClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Device: any;
}

export default class RoomClient extends EventEmitter {
  private email: string;
  private localMediaEl: HTMLElement;
  private remoteVideoEl: HTMLElement;
  private remoteAudioEl: HTMLElement;
  private mediasoupClient: MediasoupClient;
  private socket: Socket;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private producerTransport: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private consumerTransport: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private device: any;
  private room_id: string;
  private isVideoOnFullScreen: boolean = false;
  private isDevicesVisible: boolean = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private consumers: Map<string, any> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private producers: Map<string, any> = new Map();
  private producerLabel: Map<string, string> = new Map();
  private _isOpen: boolean = false;
  private eventListeners: Map<string, Array<() => void>> = new Map();
  private onAddLocalMedia?: (element: HTMLVideoElement | HTMLAudioElement) => void;
  private onRemoveLocalMedia?: (elementId: string) => void;
  private onAddRemoteMedia?: (element: HTMLVideoElement | HTMLAudioElement) => void;
  private onRemoveRemoteMedia?: (elementId: string) => void;

  constructor(
    localMediaEl: HTMLElement,
    remoteVideoEl: HTMLElement,
    remoteAudioEl: HTMLElement,
    mediasoupClient: MediasoupClient,
    socket: Socket,
    room_id: string,
    email: string,
    successCallback: () => void,
    onAddLocalMedia?: (element: HTMLVideoElement | HTMLAudioElement) => void,
    onRemoveLocalMedia?: (elementId: string) => void,
    onAddRemoteMedia?: (element: HTMLVideoElement | HTMLAudioElement) => void,
    onRemoveRemoteMedia?: (elementId: string) => void
  ) {
    super();
    this.email = email;
    this.localMediaEl = localMediaEl;
    this.remoteVideoEl = remoteVideoEl;
    this.remoteAudioEl = remoteAudioEl;
    this.mediasoupClient = mediasoupClient;
    this.socket = socket;
    this.room_id = room_id;
    this.onAddLocalMedia = onAddLocalMedia;
    this.onRemoveLocalMedia = onRemoveLocalMedia;
    this.onAddRemoteMedia = onAddRemoteMedia;
    this.onRemoveRemoteMedia = onRemoveRemoteMedia;

    console.log(`RoomClient initialized with room_id: ${this.room_id}`);

    Object.keys(_EVENTS).forEach((evt) => {
      this.eventListeners.set(evt as EventTypes, []);
    });

    this.createRoom(room_id).then(async () => {
      await this.join(email, room_id);
      this.initSockets();
      this._isOpen = true;
      successCallback();
    });
  }

  ////////// INIT /////////
  private async createRoom(room_id: string): Promise<void> {
    if (!room_id) {
      console.error("Error: Trying to create a room with undefined room_id");
      return;
    }

    // console.log(`Creating room with ID: ${room_id}`);

    try {
      await this.socket.request('createRoom', { room_id });
      console.log(`wrtc-vcall : Room ${room_id} created successfully`);
    } catch (err) {
      console.error('Create room error:', err);
    }
  }

  private async join(email: string, room_id: string): Promise<void> {
    this.socket
      .request('join', { email, room_id })
      .then(async (e) => {
        console.log('wrtc-vcall :Joined to room', e);

        const data = await this.socket.request('getRouterRtpCapabilities');
        console.log('wrtc-vcall :getRouterRtpCapabilities:', data);

        const device = await this.loadDevice(data);
        console.log("wrtc-vcall :device", device);

        this.device = device;
        await this.initTransports(device);
        console.log("wrtc-vcall :initTransports successfull");
        
        this.socket.emit('getProducers');
      })
      .catch((err) => {
        console.log('Join error:', err);
      });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async loadDevice(routerRtpCapabilities: any): Promise<any> {
    let device;
    try {
      device = new this.mediasoupClient.Device();
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((error as any).email === 'UnsupportedError') {
        console.error('Browser not supported');
        alert('Browser not supported');
      }
      console.error(error);
    }
    await device.load({ routerRtpCapabilities });
    return device;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async initTransports(device: any): Promise<void> {
    // STUN servers configuration
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
    // Initialize producerTransport
    {
      const data = await this.socket.request('createWebRtcTransport', {
        forceTcp: false,
        rtpCapabilities: device.rtpCapabilities,
      });
      console.log("wrtc-vcall :createWebRtcTransport data:", data);
      if (data.error) {
        console.error("wrtc-vcall :createWebRtcTransport data error:", data.error);
        return;
      }
  
      this.producerTransport = device.createSendTransport({ ...data, iceServers, });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.producerTransport.on('connect', async ({ dtlsParameters }: any, callback: any, errback: any) => {
        try {
          await this.socket.request('connectTransport', {
            dtlsParameters,
            transport_id: data.id,
          });
          callback();
        } catch (err) {
          errback(err);
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.producerTransport.on('produce', async ({ kind, rtpParameters }: any, callback: any, errback: any) => {
        try {
          const { producer_id } = await this.socket.request('produce', {
            producerTransportId: this.producerTransport.id,
            kind,
            rtpParameters,
          });
          callback({ id: producer_id });
        } catch (err) {
          errback(err);
        }
      });

     
      this.producerTransport.on('connectionstatechange', (state: string) => {
        switch (state) {
          case 'connecting':
            break;
  
          case 'connected':
            break;
  
          case 'failed':
            this.producerTransport!.close();
            break;
  
          default:
            break;
        }
      });
    }
  
    // Initialize consumerTransport
    {
      const data = await this.socket.request('createWebRtcTransport', {
        forceTcp: false,
      });
  
      if (data.error) {
        console.error(data.error);
        return;
      }
  
      this.consumerTransport = device.createRecvTransport({ ...data, iceServers, });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.consumerTransport.on('connect', async ({ dtlsParameters }: any, callback: any, errback: any) => {
        try {
          await this.socket.request('connectTransport', {
            dtlsParameters,
            transport_id: data.id,
          });
          callback();
        } catch (err) {
          errback(err);
        }
      });
  
      this.consumerTransport.on('connectionstatechange', (state: string) => {
        switch (state) {
          case 'connecting':
            break;
  
          case 'connected':
            break;
  
          case 'failed':
            this.consumerTransport!.close();
            break;
  
          default:
            break;
        }
      });
    }
  }

  private initSockets(): void {
    this.socket.on('consumerClosed', ({ consumer_id }) => {
      console.log('wrtc-vcall :Closing consumer:', consumer_id);
      this.removeConsumer(consumer_id);
    });

    this.socket.on('newProducers', async (data) => {
      console.log('wrtc-vcall :New producers', data);
      for (const { producer_id } of data) {
        await this.consume(producer_id);
      }
    });

    this.socket.on('disconnect', () => {
      this.exit(true);
    });
  }
  

  //////// MAIN FUNCTIONS /////////////

  public async produce(type: string, deviceId: string | null = null): Promise<void> {
    let mediaConstraints: MediaStreamConstraints = {};
    let audio = false;
    let screen = false;
    switch (type) {
      case mediaType.audio:
        mediaConstraints = {
          audio: { deviceId: deviceId as string },
          video: false,
        };
        audio = true;
        break;
      case mediaType.video:
        mediaConstraints = {
          audio: false,
          video: {
            width: { min: 640, ideal: 1920 },
            height: { min: 400, ideal: 1080 },
            deviceId: deviceId as string,
          },
        };
        break;
      case mediaType.screen:
        mediaConstraints = {};
        screen = true;
        break;
      default:
        console.error('Unrecognized media type:', type);
        return;
    }

    if (!this.device?.canProduce('video') && !audio) {
      console.error('Cannot produce video');
      return;
    }

    if (this.producerLabel.has(type)) {
      console.log('wrtc-vcall :Producer already exists for this type ' + type);
      return;
    }

    console.log('wrtc-vcall :Mediacontraints:', mediaConstraints);
    let stream: MediaStream;
    try {
      try {
        stream = screen
          ? await navigator.mediaDevices.getDisplayMedia()
          : await navigator.mediaDevices.getUserMedia(mediaConstraints);
      } catch (error) {
        console.error("Failed to access media devices:", error);
        return;
      }
      // console.log("wrtc-vcall :",navigator.mediaDevices.getSupportedConstraints());

      const track = audio ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];
      const params: ProducerOptions = { track };

      console.log("wrtc-vcall :Params:", params);

      if (!audio && !screen) {
        params.encodings = [
          { rid: 'r0', maxBitrate: 100000, scalabilityMode: 'S1T3' },
          { rid: 'r1', maxBitrate: 300000, scalabilityMode: 'S1T3' },
          { rid: 'r2', maxBitrate: 900000, scalabilityMode: 'S1T3' },
        ];
        params.codecOptions = { videoGoogleStartBitrate: 1000 };
      }

      if (!this.producerTransport) {
        throw new Error("this producerTransport is null");
      }

      console.log("wrtc-vcall :this.producerTransport", this.producerTransport);
      const producer = await this.producerTransport.produce(params);
      if (!producer) {
        throw new Error("No producer present !!");
      }

      console.log('wrtc-vcall :Producer', producer);

      this.producers.set(producer.id, producer);

      let elem: HTMLVideoElement | HTMLAudioElement;

      if (!audio) {
        elem = document.createElement('video');
        elem.srcObject = stream;
        elem.id = producer.id;
        elem.autoplay = true;
        elem.className = 'vid';
  
        if (elem instanceof HTMLVideoElement) {
          elem.playsInline = false;
        }
  
        if (this.onAddLocalMedia) {
          this.onAddLocalMedia(elem);
        }
      }
      

      // Cleanup function to avoid duplicate code
      const cleanup = () => {
        console.log('Cleaning up producer:', producer.id);

        if (elem && elem instanceof HTMLVideoElement && elem.srcObject instanceof MediaStream) {
          elem.srcObject.getTracks().forEach((track: MediaStreamTrack) => track.stop());
          elem.parentNode?.removeChild(elem);
        }

        this.producers.delete(producer.id);
      };

      producer.on('trackended', cleanup);
      producer.on('transportclose', cleanup);
      producer.on('close', cleanup);

      this.producerLabel.set(type, producer.id);

      // Trigger the right event
      switch (type) {
        case mediaType.audio:
          this.event(_EVENTS.startAudio);
          break;
        case mediaType.video:
          this.event(_EVENTS.startVideo);
          break;
        case mediaType.screen:
          this.event(_EVENTS.startScreen);
          break;
        default:
          return;
      }

    } catch (err) {
      console.log('Produce error:', err);
    }
  }


  public async consume(producer_id: string): Promise<void> {
    this.getConsumeStream(producer_id).then(({ consumer, stream, kind }) => {
      this.consumers.set(consumer.id, consumer);

      let elem: HTMLVideoElement | HTMLAudioElement;

      if (kind === 'video') {
        elem = document.createElement('video');
        elem.srcObject = stream;
        elem.id = consumer.id;
        if (elem instanceof HTMLVideoElement) {
          elem.playsInline = false;
        }
        elem.autoplay = true;
        elem.className = 'vid';

        if (this.onAddRemoteMedia) {
          this.onAddRemoteMedia(elem);
        }
      } else {
        elem = document.createElement('audio');
        elem.srcObject = stream;
        elem.id = consumer.id;
        elem.autoplay = true;

        if (this.onAddRemoteMedia) {
          this.onAddRemoteMedia(elem);
        }
      }
  
      consumer.on('trackended', () => {
        this.removeConsumer(consumer.id);
      });
  
      consumer.on('transportclose', () => {
        this.removeConsumer(consumer.id);
      });
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getConsumeStream(producerId: string): Promise<{ consumer: any; stream: MediaStream; kind: string }> {
    const { rtpCapabilities } = this.device!;
    const data = await this.socket.request('consume', {
      rtpCapabilities,
      consumerTransportId: this.consumerTransport!.id,
      producerId,
    });
    const { id, kind, rtpParameters } = data;

    const consumer = await this.consumerTransport!.consume({
      id,
      producerId,
      kind,
      rtpParameters,
    });

    const stream = new MediaStream();
    stream.addTrack(consumer.track);

    return { consumer, stream, kind };
  }

  public closeProducer(type: string): void {
    if (!this.producerLabel.has(type)) {
      console.log('wrtc-vcall :There is no producer for this type ' + type);
      return;
    }
  
    const producer_id = this.producerLabel.get(type)!;
    console.log('wrtc-vcall :Close producer', producer_id);
  
    this.socket.emit('producerClosed', { producer_id });
  
    this.producers.get(producer_id)!.close();
    this.producers.delete(producer_id);
    this.producerLabel.delete(type);
  
    if (type !== mediaType.audio) {
        if (this.onRemoveLocalMedia) {
          this.onRemoveLocalMedia(producer_id);
        }
      }
  
    switch (type) {
      case mediaType.audio:
        this.event(_EVENTS.stopAudio);
        break;
      case mediaType.video:
        this.event(_EVENTS.stopVideo);
        break;
      case mediaType.screen:
        this.event(_EVENTS.stopScreen);
        break;
      default:
        return;
    }
  }
  
  public pauseProducer(type: string): void {
    if (!this.producerLabel.has(type)) {
      console.log('wrtc-vcall :There is no producer for this type ' + type);
      return;
    }

    const producer_id = this.producerLabel.get(type)!;
    this.producers.get(producer_id)!.pause();
  }

  public resumeProducer(type: string): void {
    if (!this.producerLabel.has(type)) {
      console.log('wrtc-vcall :There is no producer for this type ' + type);
      return;
    }

    const producer_id = this.producerLabel.get(type)!;
    this.producers.get(producer_id)!.resume();
  }

  public removeConsumer(consumer_id: string): void {
    if (this.onRemoveRemoteMedia) {
      this.onRemoveRemoteMedia(consumer_id);
    }

    this.consumers.delete(consumer_id);
  }

  public exit(offline: boolean = false): void {
    const clean = () => {
      console.log("Cleaning up - consumerTransport:", this.consumerTransport, "producerTransport:", this.producerTransport);
      this._isOpen = false;
      if (this.consumerTransport) {
        this.consumerTransport.close();
        this.consumerTransport = null; // Prevent double-close
      }
      if (this.producerTransport) {
        this.producerTransport.close();
        this.producerTransport = null; // Prevent double-close
      }
      this.socket.off('disconnect');
      this.socket.off('newProducers');
      this.socket.off('consumerClosed');
  
      // Close all producers
      this.producers.forEach(producer => producer.close());
      this.producers.clear();
      this.producerLabel.clear();
  
      // Close all consumers
      this.consumers.forEach(consumer => consumer.close());
      this.consumers.clear();
    };
  
    if (!offline) {
      this.socket
        .request('exitRoom')
        .then((e) => console.log(e))
        .catch((e) => console.warn(e))
        .finally(clean);
    } else {
      clean();
    }
  
    this.event(_EVENTS.exitRoom);
  }

  ///////  HELPERS //////////
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async roomInfo(): Promise<any> {
    return await this.socket.request('getMyRoomInfo');
  }

  public static get mediaType(): typeof mediaType {
    return mediaType;
  }


  private event(evt: string): void {
    if (this.eventListeners.has(evt)) {
      this.eventListeners.get(evt)!.forEach((callback) => callback());
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public override on(evt: string, callback: (...args: any[]) => void): this {
    if (!this.eventListeners.has(evt)) {
      this.eventListeners.set(evt, []);
    }
    this.eventListeners.get(evt)!.push(callback);
    
    return super.on(evt, callback);
  }
  
  //////// GETTERS ////////

  public isOpen(): boolean {
    return this._isOpen;
  }

  public static get EVENTS(): typeof _EVENTS {
    return _EVENTS;
  }

  //////// UTILITY ////////

  public async copyURL(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      console.log('URL copied to clipboard 👍');
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  }
  

  public showDevices(): void {
    if (!this.isDevicesVisible) {
      // reveal(devicesList); // Assuming reveal is a function defined elsewhere
      this.isDevicesVisible = true;
    } else {
      // hide(devicesList); // Assuming hide is a function defined elsewhere
      this.isDevicesVisible = false;
    }
  }

}