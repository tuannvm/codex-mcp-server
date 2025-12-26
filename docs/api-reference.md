# API Reference

## Overview
Complete reference for the Codex MCP Server tools and interfaces.

This server implements the **MCP 2025-11-25 specification**, including tool annotations and progress notifications.

## Installation Options

### Claude Code
```bash
claude mcp add codex-cli -- npx -y codex-mcp-server
```

### Claude Desktop
Add to your configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows:** `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "codex-cli": {
      "command": "npx",
      "args": ["-y", "codex-mcp-server"]
    }
  }
}
```

## MCP Protocol Features

### Tool Annotations
All tools include annotations that provide hints to MCP clients about tool behavior:

| Annotation | Type | Description |
|------------|------|-------------|
| `title` | string | Human-readable tool name |
| `readOnlyHint` | boolean | Tool doesn't modify state (safe to call) |
| `destructiveHint` | boolean | Tool may modify files or external state |
| `idempotentHint` | boolean | Multiple calls produce same result |
| `openWorldHint` | boolean | Tool interacts with external services (network, APIs) |

#### Tool Annotation Matrix
| Tool | `title` | `readOnlyHint` | `destructiveHint` | `idempotentHint` | `openWorldHint` |
|------|---------|---------------|-------------------|------------------|-----------------|
| `codex` | Execute Codex CLI | `false` | `true` | `false` | `true` |
| `review` | Code Review | `true` | `false` | `true` | `true` |
| `ping` | Ping Server | `true` | `false` | `true` | `false` |
| `help` | Get Help | `true` | `false` | `true` | `false` |
| `listSessions` | List Sessions | `true` | `false` | `true` | `false` |

### Progress Notifications
For long-running operations, the server sends `notifications/progress` messages when the client includes a `progressToken` in the request `_meta`.

**Request with Progress Token:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "codex",
    "arguments": { "prompt": "Analyze this codebase" },
    "_meta": { "progressToken": "unique-token-123" }
  }
}
```

**Progress Notification (sent during execution):**
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/progress",
  "params": {
    "progressToken": "unique-token-123",
    "progress": 1,
    "message": "Processing output from Codex..."
  }
}
```

**Supported Tools:** `codex`, `review` (long-running operations)

> **Note:** Progress notifications are streamed in real-time from CLI stdout/stderr. Client support for displaying these notifications varies.

## Tools

### `codex` - AI Coding Assistant

Execute Codex CLI with advanced session management and model control.

**Annotations:** `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: true`

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | ✅ | - | The coding task, question, or analysis request |
| `sessionId` | string | ❌ | - | Session ID for conversational context |
| `resetSession` | boolean | ❌ | `false` | Reset session history before processing |
| `model` | string | ❌ | `gpt-5.2-codex` | Model to use for processing |
| `reasoningEffort` | enum | ❌ | - | Control reasoning depth |
| `sandbox` | enum | ❌ | - | Sandbox policy: `read-only`, `workspace-write`, `danger-full-access` |
| `fullAuto` | boolean | ❌ | `false` | Enable full-auto mode (sandboxed automatic execution) |
| `workingDirectory` | string | ❌ | - | Working directory for the agent |

#### Model Options
- `gpt-5.2-codex` (default) - Latest specialized coding model optimized for agentic tasks
- `gpt-5.1-codex` - Previous coding model version
- `gpt-5.1-codex-max` - Enhanced coding model for complex tasks
- `gpt-5-codex` - Base GPT-5 coding model
- `gpt-4o` - Fast multimodal model
- `gpt-4` - Advanced reasoning capabilities

#### Reasoning Effort Levels
- `low` - Quick responses, minimal processing
- `medium` - Balanced quality and speed
- `high` - Thorough analysis and comprehensive responses

#### Response Format
```typescript
interface CodexToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  _meta?: {
    sessionId?: string;
    model: string;
    reasoningEffort?: string;
  };
}
```

#### Examples

**Basic Usage:**
```json
{
  "prompt": "Explain this Python function and suggest improvements"
}
```

**With Model Selection:**
```json
{
  "prompt": "Perform complex architectural analysis",
  "model": "gpt-4",
  "reasoningEffort": "high"
}
```

**Session Management:**
```json
{
  "prompt": "Continue our previous discussion",
  "sessionId": "my-coding-session"
}
```

**Reset Session:**
```json
{
  "prompt": "Start fresh analysis",
  "sessionId": "my-coding-session",
  "resetSession": true
}
```

---

### `review` - Code Review

Run AI-powered code reviews against your repository using Codex CLI.

**Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | ❌ | - | Custom review instructions or focus areas |
| `uncommitted` | boolean | ❌ | `false` | Review staged, unstaged, and untracked changes |
| `base` | string | ❌ | - | Review changes against a specific base branch |
| `commit` | string | ❌ | - | Review changes introduced by a specific commit SHA |
| `title` | string | ❌ | - | Title to display in the review summary |
| `model` | string | ❌ | `gpt-5.2-codex` | Model to use for the review |
| `workingDirectory` | string | ❌ | - | Working directory containing the repository |

#### Examples

**Review Uncommitted Changes:**
```json
{
  "uncommitted": true
}
```

**Review Against Main Branch:**
```json
{
  "base": "main",
  "prompt": "Focus on security vulnerabilities"
}
```

**Review Specific Commit:**
```json
{
  "commit": "abc123def",
  "title": "Security Audit"
}
```

#### Response Format
```typescript
interface ReviewToolResponse {
  content: Array<{
    type: 'text';
    text: string; // Review output from Codex
  }>;
  _meta?: {
    model: string;
    base?: string;
    commit?: string;
  };
}
```

---

### `listSessions` - Session Management

List all active conversation sessions with metadata.

**Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`

#### Parameters
No parameters required.

#### Response Format
```typescript
interface SessionInfo {
  id: string;
  createdAt: string; // ISO 8601 timestamp
  lastAccessedAt: string; // ISO 8601 timestamp
  turnCount: number;
}
```

#### Example Response
```json
{
  "content": [{
    "type": "text",
    "text": "[\n  {\n    \"id\": \"abc-123-def\",\n    \"createdAt\": \"2025-01-01T12:00:00.000Z\",\n    \"lastAccessedAt\": \"2025-01-01T12:30:00.000Z\",\n    \"turnCount\": 5\n  }\n]"
  }]
}
```

---

### `ping` - Connection Test

Test MCP server connection and responsiveness.

**Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `message` | string | ❌ | `pong` | Message to echo back |

#### Example
```json
{
  "message": "Hello, server!"
}
```

#### Response
```json
{
  "content": [{
    "type": "text",
    "text": "Hello, server!"
  }]
}
```

---

### `help` - Codex CLI Help

Get information about Codex CLI capabilities and commands.

**Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`

#### Parameters
No parameters required.

#### Response
Returns the output of `codex --help` command, providing comprehensive CLI documentation.

## Session Management

### Session Lifecycle

1. **Creation**: Sessions are created automatically or explicitly via `sessionId`
2. **Activity**: Each interaction updates `lastAccessedAt` timestamp
3. **Persistence**: Sessions persist for 24 hours of inactivity
4. **Cleanup**: Automatic removal of expired sessions
5. **Limits**: Maximum 100 concurrent sessions

### Session Data Structure

```typescript
interface SessionData {
  id: string;                    // UUID-based session identifier
  createdAt: Date;              // Session creation timestamp
  lastAccessedAt: Date;         // Last interaction timestamp
  turns: ConversationTurn[];    // Conversation history
  codexConversationId?: string; // Native Codex conversation ID
}

interface ConversationTurn {
  prompt: string;    // User's original prompt
  response: string;  // Codex response
  timestamp: Date;   // Turn timestamp
}
```

### Resume Functionality

The server leverages Codex CLI v0.50.0+ native resume functionality:

1. **Conversation ID Extraction**: Automatically captures conversation IDs from Codex output
2. **Native Resume**: Uses `codex resume <conversation-id>` for optimal continuity
3. **Fallback Context**: Manual context building when native resume unavailable
4. **Seamless Integration**: Transparent to end users

## Error Handling

### Error Response Format
```typescript
interface ErrorResponse {
  content: Array<{
    type: 'text';
    text: string; // Error description
  }>;
  isError: true;
}
```

### Common Error Scenarios

#### Authentication Errors
- **Cause**: Codex CLI not authenticated
- **Message**: "Authentication failed: Please run `codex login`"
- **Resolution**: Run `codex login --api-key "your-key"`

#### Model Errors
- **Cause**: Invalid or unavailable model specified
- **Message**: "Invalid model: <model-name>"
- **Resolution**: Use supported model or omit for default

#### Session Errors
- **Cause**: Corrupted session data or invalid session ID
- **Behavior**: Graceful degradation, continues with fresh context
- **Impact**: Minimal - system auto-recovers

#### CLI Errors
- **Cause**: Codex CLI not installed or network issues
- **Message**: "Failed to execute codex command"
- **Resolution**: Install CLI and check network connectivity

## Performance Considerations

### Memory Management
- **Session TTL**: 24-hour automatic cleanup
- **Session Limits**: Maximum 100 concurrent sessions
- **Context Optimization**: Recent turns only (last 2) for fallback context

### Response Optimization
- **Model Selection**: Default `gpt-5.2-codex` optimized for agentic coding
- **Reasoning Control**: Adjust effort based on task complexity
- **Native Resume**: Preferred over manual context building

### Scalability
- **Stateless Design**: Core functionality works without sessions
- **Graceful Degradation**: Continues operation despite component failures
- **Resource Cleanup**: Automatic management of memory and storage

## Configuration

### Environment Variables
None required - authentication handled by Codex CLI.

### Codex CLI Requirements
- **Version**: 0.36.0 or later
- **Authentication**: `codex login --api-key "your-key"`
- **Verification**: `codex --help` should execute successfully

### Optional Configuration
- **CODEX_HOME**: Custom directory for Codex CLI configuration
- **Session Limits**: Configurable in server implementation (default: 100)
- **TTL Settings**: Configurable session expiration (default: 24 hours)