import mediasoup from 'mediasoup';

export default class Peer {
  id: string;
  name: string;
  transports: Map<string, mediasoup.types.Transport>;
  consumers: Map<string, mediasoup.types.Consumer>;
  producers: Map<string, mediasoup.types.Producer>;

  constructor(socket_id: string, name: string) {
    this.id = socket_id;
    this.name = name;
    this.transports = new Map();
    this.consumers = new Map();
    this.producers = new Map();
  }

  addTransport(transport: mediasoup.types.Transport) {
    this.transports.set(transport.id, transport);
  }

  async connectTransport(transport_id: string, dtlsParameters: mediasoup.types.DtlsParameters) {
    if (!this.transports.has(transport_id)) return;
    await this.transports.get(transport_id)?.connect({ dtlsParameters });
  }

  async createProducer(producerTransportId: string, rtpParameters: mediasoup.types.RtpParameters, kind: string) {
    let producer = await this.transports.get(producerTransportId)?.produce({ kind, rtpParameters }as {kind:mediasoup.types.MediaKind, rtpParameters:mediasoup.types.RtpParameters});
    if(!producer) {
        console.error('producer is null');
        return;
    }
    this.producers.set(producer.id, producer);

    producer.on('transportclose', () => {
      console.log('Producer transport close', { name: `${this.name}`, consumer_id: `${producer.id}` });
      producer.close();
      this.producers.delete(producer.id);
    });

    return producer;
  }

  async createConsumer(consumer_transport_id: string, producer_id: string, rtpCapabilities: mediasoup.types.RtpCapabilities) {
    let consumerTransport = this.transports.get(consumer_transport_id);

    let consumer = null;
    try {
        if(!consumerTransport) {
            console.error('transport not found for id', consumer_transport_id);
            return;
        }
      consumer = await consumerTransport.consume({
        producerId: producer_id,
        rtpCapabilities,
        paused: false
      });
    } catch (error) {
      console.error('Consume failed', error);
      return;
    }

    if (consumer.type === 'simulcast') {
      await consumer.setPreferredLayers({
        spatialLayer: 2,
        temporalLayer: 2
      });
    }

    this.consumers.set(consumer.id, consumer);

    consumer.on('transportclose', () => {
      console.log('Consumer transport close', { name: `${this.name}`, consumer_id: `${consumer.id}` });
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
    try {
      this.producers.get(producer_id)?.close();
    } catch (e) {
      console.warn(e);
    }

    this.producers.delete(producer_id);
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