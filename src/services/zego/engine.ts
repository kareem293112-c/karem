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
            let appId = Number((import.meta as any).env.VITE_ZEGO_APP_ID);
            let appSign = (import.meta as any).env.VITE_ZEGO_APP_SIGN;

            if (!appId || !appSign) {
                console.log("[ZEGO] Client environment variables not found. Fetching config from server...");
                try {
                    const response = await fetch("/api/auth/zego-config");
                    const data = await response.json();
                    if (data.success) {
                        appId = data.appId;
                        appSign = data.appSign;
                        console.log("[ZEGO] Successfully loaded config from server. App ID:", appId);
                    }
                } catch (err) {
                    console.error("[ZEGO] Failed to fetch config from server:", err);
                }
            }

            // Robust fallbacks for public/demo sandbox mode
            if (!appId || isNaN(appId)) {
                console.log("[ZEGO] App ID not set or invalid, falling back to default public demo ID 386648123");
                appId = 386648123;
            }
            if (!appSign || !appSign.startsWith("wss://")) {
                console.log("[ZEGO] Server signaling URL is not set or invalid, falling back to public sandbox server: wss://webliveroom-api.sandbox.zego.im/ws");
                appSign = "wss://webliveroom-api.sandbox.zego.im/ws";
            }

            console.log(
                "ZEGO CONFIG",
                appId,
                appSign
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
            // Setup a global autoplay unlocker for WebRTC audio/video elements on user interaction
            if (typeof window !== 'undefined') {
                const unlockAutoplay = () => {
                    const mediaElements = document.querySelectorAll('audio[id^="zego-audio-"], video[id^="zego-video-"]');
                    mediaElements.forEach((el) => {
                        const media = el as HTMLMediaElement;
                        if (media.paused) {
                            console.log("[ZEGO] Attempting to unlock/play blocked media element:", media.id);
                            media.play().then(() => {
                                console.log("[ZEGO] Successfully unlocked and playing media:", media.id);
                            }).catch(err => {
                                console.warn("[ZEGO] Failed to play media during unlock gesture:", media.id, err);
                            });
                        }
                    });
                };
                window.addEventListener('click', unlockAutoplay, { passive: true });
                window.addEventListener('touchstart', unlockAutoplay, { passive: true });
            }

            // Enable sound level monitoring
            try {
                if (typeof (this.zg as any).setSoundLevelMonitorCycle === 'function') {
                    (this.zg as any).setSoundLevelMonitorCycle(200);
                    console.log("[ZEGO] Sound level monitor cycle activated: 200ms");
                }
                
                (this.zg as any).on('soundLevelUpdate', (soundLevels: { streamID: string; soundLevel: number; type: string }[]) => {
                    soundLevels.forEach(item => {
                        const streamID = item.streamID;
                        const soundLevel = item.soundLevel;
                        ZegoEventBus.emit(ZegoEvents.SOUND_LEVEL_UPDATE, { streamID, soundLevel });
                    });
                });
            } catch (e) {
                console.warn("[ZEGO] Sound level monitoring setup failed or unsupported:", e);
            }

            // Register room stream update listener
            (this.zg as any).on('roomStreamUpdate', async (roomID: string, updateType: 'ADD' | 'DELETE', streamList: any[]) => {
                console.log("[ZEGO] roomStreamUpdate event:", { roomID, updateType, streamList });
                if (updateType === 'ADD') {
                    for (const stream of streamList) {
                        console.log("[ZEGO] Remote stream added:", stream.streamID);
                        try {
                            const remoteStream = await (this.zg as any).startPlayingStream(stream.streamID, {
                                video: false,
                                audio: true
                            });
                            
                            // Remove existing video/audio element for this stream if any
                            const existing = document.getElementById('zego-video-' + stream.streamID) || document.getElementById('zego-audio-' + stream.streamID);
                            if (existing) {
                                existing.remove();
                            }

                            // Create a hidden video element (more reliable for autoplay in modern mobile/desktop browsers than audio elements)
                            const video = document.createElement('video');
                            video.id = 'zego-video-' + stream.streamID;
                            video.autoplay = true;
                            video.setAttribute('playsinline', 'true');
                            (video as any).playsInline = true;
                            // Style it to be completely hidden but technically rendered so the browser doesn't pause it
                            video.style.position = 'fixed';
                            video.style.top = '0';
                            video.style.left = '0';
                            video.style.width = '1px';
                            video.style.height = '1px';
                            video.style.opacity = '0';
                            video.style.pointerEvents = 'none';
                            video.style.zIndex = '-9999';
                            
                            video.srcObject = remoteStream;
                            document.body.appendChild(video);

                            // Attempt to play explicitly
                            video.play().then(() => {
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
                            const video = document.getElementById('zego-video-' + stream.streamID) as HTMLVideoElement;
                            if (video) {
                                video.pause();
                                video.remove();
                            }
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
                if (this.localStreams.has(streamID)) {
                    console.log("[ZEGO] Already publishing stream:", streamID);
                    return;
                }
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
