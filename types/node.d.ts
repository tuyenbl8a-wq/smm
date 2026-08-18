declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
}
declare const process: {
  env: NodeJS.ProcessEnv;
  argv: string[];
  pid: number;
  exitCode?: number;
  on(event: string, listener: (...args: unknown[]) => void): void;
};
declare const Buffer: { byteLength(value: string): number };
declare module "node:http" {
  export interface IncomingMessage {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
  }
  export interface ServerResponse {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(data?: string): void;
  }
  export interface Server {
    listen(port: number, host: string, callback?: () => void): void;
    close(callback?: (error?: Error) => void): void;
  }
  export function createServer(
    handler: (
      request: IncomingMessage,
      response: ServerResponse,
    ) => void | Promise<void>,
  ): Server;
}
declare module "node:net" {
  interface Socket {
    once(event: string, listener: (...args: unknown[]) => void): void;
    setTimeout(timeout: number): void;
    destroy(): void;
  }
  export function createConnection(options: {
    host: string;
    port: number;
  }): Socket;
}
declare module "node:test" {
  const test: (name: string, callback: () => void | Promise<void>) => void;
  export default test;
}
declare module "node:assert/strict" {
  const assert: {
    equal(actual: unknown, expected: unknown): void;
    deepEqual(actual: unknown, expected: unknown): void;
    throws(callback: () => unknown, matcher?: RegExp): void;
    rejects(callback: () => Promise<unknown>, matcher?: RegExp): Promise<void>;
  };
  export default assert;
}
declare module "node:fs" {
  export function readFileSync(path: string, encoding: string): string;
}
declare module "node:url" {
  export function fileURLToPath(url: string): string;
}
declare module "node:path" {
  export function dirname(path: string): string;
  export function join(...parts: string[]): string;
}
