import { io, Socket } from 'socket.io-client';

export class SocketIOClient {
  socket: Socket;

  constructor(url: string = 'https://localhost') {
    this.socket = io(url, {
      reconnection: false,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2500,
      reconnectionDelayMax: 5000,
      autoConnect: true,
      forceNew: true    
    })
  }

  get connected(): boolean {
    return this.socket.connected;
  }

  open(): void {
    this.socket.open();
  }

  close(): void {
    this.socket.close();
  }
  
  on(event: string, fn: (...args: any[]) => void) {
    return this.socket.on(event, fn);
  }

  once(event: string, fn: (...args: any[]) => void) {
    return this.socket.once(event, fn);
  }

  off(event: string, fn?: (...args: any[]) => void) {
    return this.socket.off(event, fn);
  }

  removeAllListeners() {
    return this.socket.removeAllListeners();
  }

  emit(event: string, ...args: any[]) {
    return this.socket.emit(event, ...args);
  }

  getListeners(event: string): Function[] {
    return this.socket.listeners(event);
  }

  hasListeners(event: string): boolean {
    return this.socket.hasListeners(event);
  }
}
