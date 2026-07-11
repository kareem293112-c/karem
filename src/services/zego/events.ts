import mitt from 'mitt';

type Events = {
    [key: string]: any;
};

export const ZegoEventBus = mitt<Events>();

export const ZegoEvents = {
    USER_JOINED: 'userJoined',
    USER_LEFT: 'userLeft',
    SPEAKER_STARTED: 'speakerStarted',
    SPEAKER_STOPPED: 'speakerStopped',
    ROOM_DISCONNECTED: 'roomDisconnected',
    RECONNECTING: 'reconnecting',
    RECONNECT_SUCCESS: 'reconnectSuccess',
    STREAM_UPDATE: 'streamUpdate',
    ROOM_UPDATED: 'roomUpdated',
    SEAT_CHANGED: 'seatChanged',
    MIC_ENABLED: 'micEnabled',
    MIC_DISABLED: 'micDisabled',
    PERMISSION_DENIED: 'permissionDenied',
    HOST_CHANGED: 'hostChanged',
    SOUND_LEVEL_UPDATE: 'soundLevelUpdate',
};

export type ZegoState = 'Idle' | 'Connecting' | 'Connected' | 'Publishing' | 'Reconnecting' | 'Disconnected';
