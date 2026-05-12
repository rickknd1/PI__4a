import { Injectable, OnDestroy } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

/** Côté VEM, `@MessageMapping("/chat")` attend un JSON compatible avec `ChatMessage`. */
export interface VirtualChatPayload {
  roomId?: string;
  user?: string;
  message?: string;
  senderId?: string;
}

/** Côté VEM, aligné sur `PlayerState` + `eventId` pour filtrer par événement. */
export interface RoomPlayerPositionPayload {
  eventId?: string;
  id?: string;
  name?: string;
  color?: string;
  x: number;
  y: number;
  z: number;
  rotY?: number;
}

export type StompHandlers = {
  onChat?: (msg: VirtualChatPayload) => void;
  onPosition?: (p: RoomPlayerPositionPayload) => void;
};

/**
 * STOMP + SockJS vers le VEM (`/ws`) : chat `/topic/messages`, positions salle
 * `/topic/positions` (Mapping `/app/position`).
 */
@Injectable({ providedIn: 'root' })
export class VirtualMeetingChatService implements OnDestroy {
  private client: Client | null = null;
  private connected = false;

  connect(vemBaseUrl: string, handlers: StompHandlers): void {
    this.disconnect();
    const { onChat, onPosition } = handlers;
    const sockUrl = `${vemBaseUrl.replace(/\/$/, '')}/ws`;
    this.client = new Client({
      webSocketFactory: () => new SockJS(sockUrl) as unknown as WebSocket,
      reconnectDelay: 5000,
      onConnect: () => {
        this.connected = true;
        if (onChat) {
          this.client!.subscribe('/topic/messages', (raw: IMessage) => {
            try {
              onChat(JSON.parse(raw.body) as VirtualChatPayload);
            } catch {
              onChat({ message: raw.body });
            }
          });
        }
        if (onPosition) {
          this.client!.subscribe('/topic/positions', (raw: IMessage) => {
            try {
              onPosition(JSON.parse(raw.body) as RoomPlayerPositionPayload);
            } catch {
              /* ignore */
            }
          });
        }
      },
      onStompError: (frame) => {
        // eslint-disable-next-line no-console
        console.warn('[VirtualVemStomp] STOMP error', frame);
      },
    });
    this.client.activate();
  }

  sendChat(payload: VirtualChatPayload): void {
    if (!this.client || !this.connected) {
      return;
    }
    this.client.publish({ destination: '/app/chat', body: JSON.stringify(payload) });
  }

  sendPosition(payload: RoomPlayerPositionPayload): void {
    if (!this.client || !this.connected) {
      return;
    }
    this.client.publish({ destination: '/app/position', body: JSON.stringify(payload) });
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect(): void {
    this.connected = false;
    this.client?.deactivate();
    this.client = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
