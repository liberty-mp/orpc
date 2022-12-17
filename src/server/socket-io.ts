import { createServer, Server as HTTPServer} from 'http';

import { Server, Socket } from 'socket.io';

export class SocketIOServer {
  public http: HTTPServer;
  public socket: Server;

  public constructor() {
    this.http = createServer();
    this.socket = new Server(this.http);
  }

  public start(port?: number, hostname?: string): void {
    this.http.listen(port, hostname);
  }

  public stop(): void {
    this.socket.close();
    this.http.close();
  }

  public on(event: 'connection', listener: (socket: Socket) => void): void
  public on(event: string, listener: (...args: any[]) => void) {
    return this.socket.on(event, listener);
  }

  public emit(event: string, ...args: any[]) {
    return this.socket.emit(event, ...args);
  }
}
