import { type BinaryInfo } from './types.js';
import { discoverBinary } from './discovery.js';
import { ComputerUseClient } from './client.js';

export class ComputerUseBridge {
  private static instance?: ComputerUseBridge;
  private client?: ComputerUseClient;
  private binaryInfo?: BinaryInfo;
  private initialized = false;
  private error?: Error;
  private initPromise?: Promise<void>;

  private constructor() {}

  static getInstance(): ComputerUseBridge {
    if (!ComputerUseBridge.instance) {
      ComputerUseBridge.instance = new ComputerUseBridge();
    }
    return ComputerUseBridge.instance;
  }

  async initialize(): Promise<void> {
    // Fast path: already connected.
    if (this.initialized && this.client?.isConnected()) return;

    // Serialize concurrent callers — they coalesce onto the same promise.
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = undefined;
    }
  }

  private async _doInitialize(): Promise<void> {
    // Re-check after acquiring the lock.
    if (this.initialized && this.client?.isConnected()) return;

    if (this.client) {
      this.client.disconnect();
      this.client = undefined;
    }
    this.initialized = false;
    this.error = undefined;

    try {
      this.binaryInfo = discoverBinary();
      console.error(
        `Computer Use: using binary at ${this.binaryInfo.path} (${this.binaryInfo.type})`
      );

      this.client = new ComputerUseClient(this.binaryInfo);
      await this.client.connect();

      this.initialized = true;
      console.error('Computer Use: bridge connected');
    } catch (err) {
      this.error = err instanceof Error ? err : new Error(String(err));
      console.error(`Computer Use: ${this.error.message}`);
      this.client?.disconnect();
      this.client = undefined;
      throw this.error;
    }
  }

  getClient(): ComputerUseClient {
    if (!this.client || !this.initialized) {
      throw new Error('Computer Use bridge not initialized');
    }
    return this.client;
  }

  isReady(): boolean {
    return this.initialized && this.client?.isConnected() === true;
  }

  getBinaryInfo(): BinaryInfo | undefined {
    return this.binaryInfo;
  }

  getError(): Error | undefined {
    return this.error;
  }

  async shutdown(): Promise<void> {
    this.client?.disconnect();
    this.client = undefined;
    this.initialized = false;
  }
}
