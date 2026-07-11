import { ZegoEngineManager } from './engine';
import { zegoPublisher } from './publisher';
import { zegoPlayer } from './player';
import { ZegoEventBus, ZegoEvents } from './events';
import { RoomStateManager } from '../room/roomState';
import { SeatManager } from '../room/seatManager';
import { PermissionManager } from '../room/permissionManager';
import { User, RoomState } from '../room/types';

export class ZegoRoomController {
    private stateManager: RoomStateManager;

    constructor() {
        this.stateManager = new RoomStateManager({
            roomId: '',
            hostId: '',
            seats: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, userId: null, mic: false, isLocked: false })),
            listeners: 0,
            locked: false
        });
    }

    public async joinRoom(roomID: string, user: User) {
        const engine = await ZegoEngineManager.getInstance().getEngine();
        if (engine) {
            await (engine as any).loginRoom(roomID, { userID: user.id, userName: user.name });
            this.stateManager.updateState({ roomId: roomID });
            ZegoEventBus.emit(ZegoEvents.USER_JOINED, user);
        }
    }

    public async leaveRoom(roomID: string) {
        const engine = await ZegoEngineManager.getInstance().getEngine();
        if (engine) {
            await (engine as any).logoutRoom(roomID);
        }
    }

    public async requestSeat(seatId: number, user: User) {
        if (!PermissionManager.canTakeAction(user.role, 'takeSeat')) {
            ZegoEventBus.emit(ZegoEvents.PERMISSION_DENIED, 'Cannot take seat');
            return;
        }
        const newSeats = SeatManager.takeSeat(this.stateManager.getState().seats, seatId, user.id);
        this.stateManager.updateState({ seats: newSeats });
        ZegoEventBus.emit(ZegoEvents.SEAT_CHANGED, newSeats);
    }

    public async openMic(seatId: number, user: User, streamID: string) {
        if (!PermissionManager.canTakeAction(user.role, 'openMic')) {
            ZegoEventBus.emit(ZegoEvents.PERMISSION_DENIED, 'Cannot open mic');
            return;
        }
        const newSeats = SeatManager.toggleMic(this.stateManager.getState().seats, seatId);
        this.stateManager.updateState({ seats: newSeats });
        await zegoPublisher.start(streamID);
        ZegoEventBus.emit(ZegoEvents.MIC_ENABLED, seatId);
    }

    public async closeMic(seatId: number, user: User, streamID: string) {
        if (!PermissionManager.canTakeAction(user.role, 'closeMic')) {
            ZegoEventBus.emit(ZegoEvents.PERMISSION_DENIED, 'Cannot close mic');
            return;
        }
        const newSeats = SeatManager.toggleMic(this.stateManager.getState().seats, seatId);
        this.stateManager.updateState({ seats: newSeats });
        await zegoPublisher.stop(streamID);
        ZegoEventBus.emit(ZegoEvents.MIC_DISABLED, seatId);
    }
}
export const zegoRoom = new ZegoRoomController();
