import { ZegoEngineManager } from './engine';
import { ZegoEventBus, ZegoEvents } from './events';

export class ZegoPublisherService {
    public async start(streamID: string) {
        console.log("START PUBLISH STREAM", streamID);
        const engine = await ZegoEngineManager.getInstance().getEngine();
        if (engine) {
            await (engine as any).startPublishingStream(streamID);
            console.log("PUBLISH SUCCESS", streamID);
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
