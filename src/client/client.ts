import { red, yellow } from 'colorette';
import { nanoid } from 'nanoid'

import {
  CallData,
  CallOptions,
  RPCSchema,
  RespondCode,
  RespondData,
  ServicePrototype,
} from '../shared';

import { SocketIOClient } from './socket-io-client';

type ServiceMethod<T = any> = (...args: any[]) => T;

type PromisifyFunction<F extends ServiceMethod> = ReturnType<F> extends Promise<
  any
>
  ? F
  : (...params: Parameters<F>) => Promise<ReturnType<F>>;

type SelectOutMethodAndPromisify<S extends ServicePrototype> = {
  [K in keyof S]: S[K] extends ServiceMethod ? PromisifyFunction<S[K]> : never
};

export type RPCClient<Schema extends RPCSchema> = {
  [K in keyof Schema]: SelectOutMethodAndPromisify<Schema[K]>
} & {
  $portal: Client;
};

export interface CallInfo {
  callUUID: string;
  resolve(result?: any): void;
  reject(reason: any): void;
}

export class Client {
  private readonly socketIO: SocketIOClient;
  private callInfoSet = new Map<string, CallInfo>();
  private reconnectTimeout: NodeJS.Timeout | null = null;

  public constructor(url?: string) {
    this.socketIO = new SocketIOClient(url);

    this.initializeSocketIO();
  }

  public open(): void {
    this.socketIO.open();
  }

  public close(): void {
    this.socketIO.close();
  }

  async call(service: string, data: CallData): Promise<any>;
  async call(
    service: string,
    method: string,
    params: any[],
    options: CallOptions,
  ): Promise<any>;
  async call(
    service: string,
    method: string | CallData,
    params?: any[],
    options?: CallOptions,
  ): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      let callUUID = nanoid();

      let callData: CallData =
        typeof method === 'object'
          ? method
          : {
              callUUID,
              method,
              params,
              options,
            };

      ({callUUID} = callData);

      let callInfo: CallInfo = {callUUID, resolve, reject};

      this.callInfoSet.set(callUUID, callInfo);

      this.socketIO.emit('call', service, callData);
    });
  }

  private initializeSocketIO(): void {
    let reconnectingLog = false
    
    this.socketIO.on('connect', () => {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      console.log(`${yellow('[SOCKET]')} Connection established.`)
      reconnectingLog = true
    })
    
    this.socketIO.on('connect_error', () => {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      
      this.rejectCalls()
      
      if (!reconnectingLog) {
        console.log(`${red('[SOCKET]')} Connection error. Reconnecting...`)
        reconnectingLog = true
      }
      
      this.reconnectTimeout = setTimeout(() => {
        this.open()
      }, 5_000)
    })
    
    this.socketIO.on('disconnect', () => {
      this.rejectCalls()
      console.log(`${red('[SOCKET]')} Disconnected. Reconnecting...`)
      this.open()
    })
    
    this.socketIO.on('respond', (response: RespondData) => {
      let { callUUID, code, body } = response;

      let callInfo = this.callInfoSet.get(callUUID);

      if (!callInfo) {
        return
      }

      let { resolve, reject } = callInfo;

      switch (code) {
        case RespondCode.failure:
          reject(new Error(body));
          break;
        case RespondCode.success:
          resolve(body);
          break;
      }
    });
  }
  
  private rejectCalls() {
    for (let callInfo of this.callInfoSet.values()) {
      callInfo.reject(new Error('Connection closed'));
    }
    
    this.callInfoSet.clear();
  }
}

export function createClient<Schema extends RPCSchema>(
  url?: string,
): RPCClient<Schema> {
  let object = { $portal: new Client(url) };

  let handler: ProxyHandler<typeof object> = {
    get(target, service: string): any {
      let methodHandler: ProxyHandler<{}> = {
        get(_target, method: string): any {
          return async (...args: any[]): Promise<any> => {
            return target.$portal.call(service, method, args, {});
          };
        },
      };

      if (service === '$portal') {
        return object.$portal;
      }

      return new Proxy({}, methodHandler);
    },
  };

  return new Proxy(object, handler) as RPCClient<Schema>;
}
