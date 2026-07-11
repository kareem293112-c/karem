import { ZegoEngineManager } from './engine';
import { ZegoEventBus, ZegoEvents } from './events';

export class ZegoPlayerService {
    constructor() {
        ZegoEventBus.on(ZegoEvents.STREAM_UPDATE, this.handleStreamUpdate);
    }

    private handleStreamUpdate = (data: { updateType: string, streamList: any[] }) => {
        const { updateType, streamList } = data;
        if (updateType === 'ADD') {
            streamList.forEach(stream => {
                console.log("REMOTE STREAM ADDED:", stream.streamID);
                this.play(stream.streamID);
                ZegoEventBus.emit(ZegoEvents.SPEAKER_STARTED, stream.streamID);
            });
        } else if (updateType === 'DELETE') {
            streamList.forEach(stream => {
                console.log("REMOTE STREAM REMOVED:", stream.streamID);
                this.stop(stream.streamID);
                ZegoEventBus.emit(ZegoEvents.SPEAKER_STOPPED, stream.streamID);
            });
        }
    }

    public async play(streamID: string) {
        const engine = await ZegoEngineManager.getInstance().getEngine();
        if (engine) {
            await (engine as any).startPlayingStream(streamID);
        }
    }

    public async stop(streamID: string) {
        const engine = await ZegoEngineManager.getInstance().getEngine();
        if (engine) {
            await (engine as any).stopPlayingStream(streamID);
        }
    }
}
export const zegoPlayer = new ZegoPlayerService();
