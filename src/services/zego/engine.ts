import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import { ZegoEventBus, ZegoEvents, ZegoState } from './events';

export class ZegoEngineManager {
    private static instance: ZegoEngineManager;
    private zg: ZegoExpressEngine | null = null;
    private state: ZegoState = 'Idle';

    private constructor() {}

    public static getInstance(): ZegoEngineManager {
        if (!ZegoEngineManager.instance) {
            ZegoEngineManager.instance = new ZegoEngineManager();
        }
        return ZegoEngineManager.instance;
    }

    public async getEngine(): Promise<ZegoExpressEngine | null> {
        if (!this.zg) {
            this.state = 'Connecting';
            const appId = Number(import.meta.env.VITE_ZEGO_APP_ID);
            const appSign = import.meta.env.VITE_ZEGO_APP_SIGN;

            console.log(
                "ZEGO CONFIG",
                import.meta.env.VITE_ZEGO_APP_ID,
                import.meta.env.VITE_ZEGO_APP_SIGN
            );

            if (!appId || !appSign) {
                console.warn('VITE_ZEGO_APP_ID and VITE_ZEGO_APP_SIGN are not set.');
                this.state = 'Disconnected';
                return null;
            }

            this.zg = new ZegoExpressEngine(appId, appSign);
            await this.setupEngine();
            this.state = 'Connected';
        }
        return this.zg;
    }

    private async setupEngine() {
        try {
            // await (this.zg as any).setScenario(3);
            // (this.zg as any).enableHeadphoneMonitoring(true);

            (this.zg as any).on('roomStreamUpdate', (roomID: string, updateType: string, streamList: any[]) => {
                ZegoEventBus.emit(ZegoEvents.STREAM_UPDATE, { roomID, updateType, streamList });
            });
        } catch (e) {
            console.error("Failed to setup Zego engine", e);
        }
    }

    public async startPublishing(streamID: string) {
        const engine = await this.getEngine();
        if (engine) {
            (engine as any).startPublishingStream(streamID);
            this.state = 'Publishing';
        }
    }

    public async stopPublishing(streamID: string) {
        const engine = await this.getEngine();
        if (engine) {
            (engine as any).stopPublishingStream(streamID);
            this.state = 'Connected';
        }
    }
}
