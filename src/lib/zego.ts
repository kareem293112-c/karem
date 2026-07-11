import { ZegoEngineManager } from '../services/zego/engine';

export async function getZegoEngine() {
    return await ZegoEngineManager.getInstance().getEngine();
}

export async function startPublishing(streamID: string) {
    await ZegoEngineManager.getInstance().startPublishing(streamID);
}

export async function stopPublishing(streamID: string) {
    await ZegoEngineManager.getInstance().stopPublishing(streamID);
}
