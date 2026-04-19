import { spawn, type ChildProcess } from 'child_process';
import { type BinaryInfo, type JsonRpcResponse } from './types.js';
import { type ToolResult } from '../types.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const SCREENSHOT_TIMEOUT_MS = 60_000;
const INIT_PROTOCOL_VERSION = '2024-11-05';

export class ComputerUseClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pending = new Map<
    number,
    {
      resolve: (resp: JsonRpcResponse) => void;
      reject: (err: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private buffer = '';
  private connected = false;

  constructor(private binary: BinaryInfo) {}

  async connect(): Promise<void> {
    if (this.connected) return;

    this.process = spawn(this.binary.path, this.binary.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.process.on('error', (err) => {
      this.rejectAll(new Error(`Binary spawn failed: ${err.message}`));
    });

    this.process.on('close', () => {
      this.connected = false;
      this.process = null;
      this.rejectAll(new Error('Binary process exited unexpectedly'));
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      this.drainBuffer();
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      // Binary log messages go to stderr — forward at debug level.
      if (process.env.NODE_DEBUG?.includes('computer-use')) {
        process.stderr.write(data);
      }
    });

    // MCP initialize handshake.
    const initResult = await this.sendRequest('initialize', {
      protocolVersion: INIT_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'codex-mcp-server', version: '0.1.0' },
    });

    if (!initResult.result) {
      throw new Error(`Binary initialize failed: ${JSON.stringify(initResult.error)}`);
    }

    // Send initialized notification (no id = notification).
    this.sendNotification('notifications/initialized', {});
    this.connected = true;
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
    timeoutMs = name === 'get_app_state' ? SCREENSHOT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS
  ): Promise<ToolResult> {
    if (!this.connected) throw new Error('Not connected');

    const resp = await this.sendRequest('tools/call', { name, arguments: args }, timeoutMs);

    if (resp.error) {
      return {
        content: [{ type: 'text', text: `Binary error: ${resp.error.message}` }],
        isError: true,
      };
    }

    // The binary returns MCP CallToolResult shape.
    const result = resp.result as {
      content?: Array<{
        type: string;
        text?: string;
        data?: string;
        mimeType?: string;
      }>;
      isError?: boolean;
    };

    // Pass through content as-is, preserving image data from get_app_state screenshots.
    const content = (result?.content || []).map((item) => ({
      type: item.type as 'text' | 'image',
      text: item.text || '',
      data: item.data,
      mimeType: item.mimeType,
    }));

    return {
      content: content.length > 0 ? content : [{ type: 'text', text: JSON.stringify(result) }],
      isError: result?.isError,
    };
  }

  disconnect(): void {
    this.process?.kill();
    this.process = null;
    this.connected = false;
    this.rejectAll(new Error('Client disconnected'));
  }

  isConnected(): boolean {
    return this.connected;
  }

  private sendRequest(
    method: string,
    params: Record<string, unknown>,
    timeoutMs = DEFAULT_TIMEOUT_MS
  ): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
      this.process?.stdin?.write(msg);
    });
  }

  private sendNotification(
    method: string,
    params: Record<string, unknown>
  ): void {
    const msg = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n';
    this.process?.stdin?.write(msg);
  }

  private drainBuffer(): void {
    // Binary uses bare newline-delimited JSON-RPC (no Content-Length framing).
    const lines = this.buffer.split('\n');
    // Last element may be incomplete — keep it in the buffer.
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as JsonRpcResponse;
        // Only handle responses (have an id). Notifications are id-less.
        if (msg.id !== undefined) {
          const pending = this.pending.get(msg.id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pending.delete(msg.id);
            pending.resolve(msg);
          }
        }
      } catch {
        // Ignore non-JSON lines (log messages, etc.)
      }
    }
  }

  private rejectAll(err: Error): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(err);
    }
    this.pending.clear();
  }
}
