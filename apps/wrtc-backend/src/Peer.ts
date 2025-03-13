import mediasoup from 'mediasoup';

export default class Peer {
  id: string;
  email: string;
  transports: Map<string, mediasoup.types.Transport>;
  consumers: Map<string, mediasoup.types.Consumer>;
  producers: Map<string, mediasoup.types.Producer>;

  constructor(socket_id: string, email: string) {
    this.id = socket_id;
    this.email = email;
    this.transports = new Map();
    this.consumers = new Map();
    this.producers = new Map();
  }

  addTransport(transport: mediasoup.types.Transport) {
    this.transports.set(transport.id, transport);
  }

  async connectTransport(transport_id: string, dtlsParameters: mediasoup.types.DtlsParameters) {
    // if (!this.transports.has(transport_id)) return;
    // await this.transports.get(transport_id)?.connect({ dtlsParameters });
    const transport = this.transports.get(transport_id);
    if (!transport) throw new Error(`Transport ${transport_id} not found`);
    await transport.connect({ dtlsParameters }).catch((err) => {
      console.error(`Failed to connect transport ${transport_id}`, err);
      throw err;
    });
  }

  async createProducer(producerTransportId: string, rtpParameters: mediasoup.types.RtpParameters, kind: string) {
    // let producer = await this.transports.get(producerTransportId)?.produce({ kind, rtpParameters }as {kind:mediasoup.types.MediaKind, rtpParameters:mediasoup.types.RtpParameters});
    // if(!producer) {
    //     console.error('producer is null');
    //     return;
    // }
    // this.producers.set(producer.id, producer);

    // producer.on('transportclose', () => {
    //   console.log('Producer transport close', { email: `${this.email}`, consumer_id: `${producer.id}` });
    //   producer.close();
    //   this.producers.delete(producer.id);
    // });

    // return producer;
    const transport = this.transports.get(producerTransportId);
    if (!transport) throw new Error(`Transport ${producerTransportId} not found`);
    const producer = await transport.produce({ kind, rtpParameters } as { kind:mediasoup.types.MediaKind, rtpParameters:mediasoup.types.RtpParameters }).catch((err) => {
      console.error(`Failed to create producer`, err);
      throw err;
    });
    this.producers.set(producer.id, producer);

    producer.on('transportclose', () => {
      console.log(`Producer transport closed for ${this.email}, producer_id: ${producer.id}`);
      producer.close();
      this.producers.delete(producer.id);
    });

    return producer;
  }

  async createConsumer(consumer_transport_id: string, producer_id: string, rtpCapabilities: mediasoup.types.RtpCapabilities) {
    // let consumerTransport = this.transports.get(consumer_transport_id);

    // let consumer = null;
  //   try {
  //     if(!consumerTransport) {
  //         console.error('transport not found for id', consumer_transport_id);
  //         return;
  //     }
  //   consumer = await consumerTransport.consume({
  //     producerId: producer_id,
  //     rtpCapabilities,
  //     paused: false
  //   });
  // } catch (error) {
  //   console.error('Consume failed', error);
  //   return;
  // }

  // if (consumer.type === 'simulcast') {
  //   await consumer.setPreferredLayers({
  //     spatialLayer: 2,
  //     temporalLayer: 2
  //   });
  // }

  // this.consumers.set(consumer.id, consumer);
  
  // consumer.on('transportclose', () => {
  //   console.log('Consumer transport close', { email: `${this.email}`, consumer_id: `${consumer.id}` });
  //   this.consumers.delete(consumer.id);
  // });

//   return {
//     consumer,
//     params: {
//       producerId: producer_id,
//       id: consumer.id,
//       kind: consumer.kind,
//       rtpParameters: consumer.rtpParameters,
//       type: consumer.type,
//       producerPaused: consumer.producerPaused
//     }
//   };
// }

// closeProducer(producer_id: string) {
//   try {
//     this.producers.get(producer_id)?.close();
//   } catch (e) {
//     console.warn(e);
//   }

//   this.producers.delete(producer_id);
// }

    const consumerTransport = this.transports.get(consumer_transport_id);
    if (!consumerTransport) throw new Error(`Transport ${consumer_transport_id} not found`);

    let consumer: mediasoup.types.Consumer;
    try {
      consumer = await consumerTransport.consume({
        producerId: producer_id,
        rtpCapabilities,
        paused: false,
      });
      if (consumer.type === 'simulcast') {
        await consumer.setPreferredLayers({ spatialLayer: 2, temporalLayer: 2 }).catch((err) => console.error('Failed to set layers', err));
      }
    } catch (error) {
      console.error('Consume failed', error);
      throw error;
    }

    this.consumers.set(consumer.id, consumer);

    consumer.on('transportclose', () => {
      console.log(`Consumer transport closed for ${this.email}, consumer_id: ${consumer.id}`);
      this.consumers.delete(consumer.id);
    });
    
    return {
      consumer,
      params: {
        producerId: producer_id,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused
      }
    };
  }

  closeProducer(producer_id: string) {
    const producer = this.producers.get(producer_id);
    if (producer) {
      producer.close();
      this.producers.delete(producer_id);
    }
  }

  getProducer(producer_id: string) {
    return this.producers.get(producer_id);
  }

  close() {
    this.transports.forEach((transport) => transport.close());
  }

  removeConsumer(consumer_id: string) {
    this.consumers.delete(consumer_id);
  }
}