import { ZegoEngineManager } from './engine';
import { ZegoEventBus, ZegoEvents } from './events';

export class ZegoPublisherService {
    public async start(streamID: string) {
        const engine = await ZegoEngineManager.getInstance().getEngine();
        if (engine) {
            await (engine as any).startPublishingStream(streamID);
            ZegoEventBus.emit(ZegoEvents.SPEAKER_STARTED, streamID);
        }
    }

    public async stop(streamID: string) {
        const engine = await ZegoEngineManager.getInstance().getEngine();
        if (engine) {
            await (engine as any).stopPublishingStream(streamID);
            ZegoEventBus.emit(ZegoEvents.SPEAKER_STOPPED, streamID);
        }
    }
}
export const zegoPublisher = new ZegoPublisherService();
