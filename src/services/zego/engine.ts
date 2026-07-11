import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import { ZegoEventBus, ZegoEvents, ZegoState } from './events';

export class ZegoEngineManager {
    private static instance: ZegoEngineManager;
    private zg: ZegoExpressEngine | null = null;
    private state: ZegoState = 'Idle';
    private localStreams: Map<string, any> = new Map();

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
            const appId = Number((import.meta as any).env.VITE_ZEGO_APP_ID);
            const appSign = (import.meta as any).env.VITE_ZEGO_APP_SIGN;

            console.log(
                "ZEGO CONFIG",
                (import.meta as any).env.VITE_ZEGO_APP_ID,
                (import.meta as any).env.VITE_ZEGO_APP_SIGN
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
            // Setup a global autoplay unlocker for WebRTC audio elements on user interaction
            if (typeof window !== 'undefined') {
                const unlockAutoplay = () => {
                    const audios = document.querySelectorAll('audio[id^="zego-audio-"]');
                    audios.forEach((el) => {
                        const audio = el as HTMLAudioElement;
                        if (audio.paused) {
                            console.log("[ZEGO] Attempting to unlock/play blocked audio element:", audio.id);
                            audio.play().then(() => {
                                console.log("[ZEGO] Successfully unlocked and playing audio:", audio.id);
                            }).catch(err => {
                                console.warn("[ZEGO] Failed to play audio during unlock gesture:", audio.id, err);
                            });
                        }
                    });
                };
                window.addEventListener('click', unlockAutoplay, { passive: true });
                window.addEventListener('touchstart', unlockAutoplay, { passive: true });
            }

            // Register room stream update listener
            (this.zg as any).on('roomStreamUpdate', async (roomID: string, updateType: 'ADD' | 'DELETE', streamList: any[]) => {
                console.log("[ZEGO] roomStreamUpdate event:", { roomID, updateType, streamList });
                if (updateType === 'ADD') {
                    for (const stream of streamList) {
                        console.log("[ZEGO] Remote stream added:", stream.streamID);
                        try {
                            const remoteStream = await (this.zg as any).startPlayingStream(stream.streamID);
                            
                            // Remove existing audio element for this stream if any
                            const existing = document.getElementById('zego-audio-' + stream.streamID);
                            if (existing) {
                                existing.remove();
                            }

                            const audio = document.createElement('audio');
                            audio.id = 'zego-audio-' + stream.streamID;
                            audio.autoplay = true;
                            audio.setAttribute('playsinline', 'true');
                            (audio as any).playsInline = true;
                            audio.srcObject = remoteStream;
                            document.body.appendChild(audio);

                            // Attempt to play explicitly
                            audio.play().then(() => {
                                console.log("[ZEGO] Successfully playing remote stream:", stream.streamID);
                            }).catch(err => {
                                console.warn("[ZEGO] Autoplay prevented for stream (will unlock on next click/touch):", stream.streamID, err);
                            });
                        } catch (err) {
                            console.error("[ZEGO] Failed to play stream:", stream.streamID, err);
                        }
                    }
                } else if (updateType === 'DELETE') {
                    for (const stream of streamList) {
                        console.log("[ZEGO] Remote stream removed:", stream.streamID);
                        try {
                            await (this.zg as any).stopPlayingStream(stream.streamID);
                            const audio = document.getElementById('zego-audio-' + stream.streamID) as HTMLAudioElement;
                            if (audio) {
                                audio.pause();
                                audio.remove();
                            }
                            console.log("[ZEGO] Successfully stopped playing stream:", stream.streamID);
                        } catch (err) {
                            console.error("[ZEGO] Failed to stop playing stream:", stream.streamID, err);
                        }
                    }
                }
                ZegoEventBus.emit(ZegoEvents.STREAM_UPDATE, { roomID, updateType, streamList });
            });
        } catch (e) {
            console.error("Failed to setup Zego engine", e);
        }
    }

    public async startPublishing(streamID: string) {
        const engine = await this.getEngine();
        if (engine) {
            try {
                console.log("[ZEGO] Creating local audio-only stream for:", streamID);
                const localStream = await (engine as any).createStream({
                    camera: {
                        audio: true,
                        video: false,
                    }
                });
                console.log("[ZEGO] Starting stream publishing:", streamID);
                await (engine as any).startPublishingStream(streamID, localStream);
                this.localStreams.set(streamID, localStream);
                this.state = 'Publishing';
                console.log("[ZEGO] Publish stream success!", streamID);
            } catch (err) {
                console.error("[ZEGO] Failed to start publishing:", err);
            }
        }
    }

    public async stopPublishing(streamID: string) {
        const engine = await this.getEngine();
        if (engine) {
            try {
                console.log("[ZEGO] Stopping stream publishing:", streamID);
                await (engine as any).stopPublishingStream(streamID);
                const localStream = this.localStreams.get(streamID);
                if (localStream) {
                    await (engine as any).destroyStream(localStream);
                    this.localStreams.delete(streamID);
                }
                this.state = 'Connected';
                console.log("[ZEGO] Stop publishing stream success!", streamID);
            } catch (err) {
                console.error("[ZEGO] Failed to stop publishing:", err);
            }
        }
    }
}
