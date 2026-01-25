# Codex CLI v0.75.0+ Integration Guide

## Overview
This document outlines the integration with OpenAI Codex CLI v0.75.0+, highlighting breaking changes, new features, and implementation details for the MCP server wrapper.

## Version Compatibility

### Recommended Version: v0.75.0+
This MCP server is optimized for **codex CLI v0.75.0 or later** for full feature support.

**Version History:**
- **v0.75.0**: Added `codex review` command, sandbox modes, full-auto mode
- **v0.74.0**: Introduced `gpt-5.2-codex` model
- **v0.50.0**: Introduced `--skip-git-repo-check` flag, removed `--reasoning-effort` flag
- **v0.36.0-v0.49.x**: Not compatible with this MCP server version (use older MCP releases)

## Breaking Changes ⚠️

### v0.75.0 Changes (Current)
1. **Resume command moved under exec**
   - **Old**: `codex resume <id>`
   - **New**: `codex exec resume <id>`
   - Impact: MCP server updated to use new command structure

### v0.50.0 Changes
1. **`--skip-git-repo-check` flag now required**
   - Required when running outside git repositories or in untrusted directories
   - Prevents "Not inside a trusted directory" errors
   - Impact: All exec-based MCP server commands include this flag

2. **`--reasoning-effort` flag changed**
   - The standalone flag was removed in codex CLI v0.50.0
   - Now passed via `-c model_reasoning_effort=<level>` config flag
   - Impact: MCP server updated to use new config-based approach

### v0.36.0 Changes (Historical)
1. **Authentication Method Change**
   - **Old Method**: `OPENAI_API_KEY` environment variable
   - **New Method**: `codex login --api-key "your-api-key"`
   - **Storage**: Credentials now stored in `CODEX_HOME/auth.json`
   - **Impact**: Users must re-authenticate using the new login command

## New Features Implemented

### 1. Code Review (v0.75.0+)
- **Command**: `codex review` (top-level subcommand)
- **CLI Flags**:
  - `--uncommitted`: Review staged, unstaged, and untracked changes
  - `--base <branch>`: Review changes against a base branch
  - `--commit <sha>`: Review changes introduced by a specific commit
  - `--title <title>`: Optional title for review summary
- **MCP Tool**: New `review` tool with all parameters exposed

### 2. Sandbox Mode (v0.75.0+)
- **CLI Flag**: `--sandbox <mode>`
- **Modes**:
  - `read-only`: No file writes allowed
  - `workspace-write`: Writes only in workspace directory
  - `danger-full-access`: Full system access (dangerous)
- **MCP Parameter**: `sandbox` parameter in codex tool

### 3. Full-Auto Mode (v0.75.0+)
- **CLI Flag**: `--full-auto`
- **Description**: Sandboxed automatic execution without approval prompts
- **Equivalent to**: `-a on-request --sandbox workspace-write`
- **MCP Parameter**: `fullAuto` boolean parameter

### 4. Working Directory (v0.75.0+)
- **CLI Flag**: `-C <dir>`
- **Description**: Set working directory for the agent (global option)
- **MCP Parameter**: `workingDirectory` parameter in codex tool and review tool

### 5. Model Selection
- **Default Model**: `gpt-5.2-codex` (optimal for agentic coding tasks)
- **CLI Flag**: `--model <model-name>`
- **Supported Models**:
  - `gpt-5.2-codex` (default, specialized for agentic coding)
  - `gpt-5.1-codex` (previous coding model)
  - `gpt-5.1-codex-max` (enhanced coding)
  - `gpt-5-codex` (base GPT-5 coding)
  - `gpt-4o` (fast multimodal)
  - `gpt-4` (advanced reasoning)
  - `o3` (OpenAI reasoning model)
  - `o4-mini` (compact reasoning model)
- **Usage**: Model parameter available in `exec`, `resume`, and `review` modes (use `-c model="..."` for review/resume)

### 6. Reasoning Effort Control
- **CLI Flag**: `-c model_reasoning_effort="<level>"`
- **Levels**: `minimal`, `low`, `medium`, `high`
- **MCP Parameter**: `reasoningEffort` parameter in codex tool
- **Note**: The standalone `--reasoning-effort` flag was removed in v0.50.0, now uses quoted config values for consistency

### 7. Native Resume Functionality
- **Command**: `codex exec resume <conversation-id>`
- **Automatic ID Extraction**: Server extracts conversation IDs from CLI output (supports both "session id" and "conversation id" formats)
- **Regex Pattern**: `/(conversation|session)\s*id\s*:\s*([a-zA-Z0-9-]+)/i`
- **Fallback Strategy**: Manual context building when resume unavailable
- **Session Integration**: Seamless integration with session management

### 8. Thread ID Metadata (v0.87.0+)
- **Output**: Codex CLI emits `threadId` in MCP responses
- **Server Behavior**: This MCP server surfaces `threadId` in tool response metadata and content element metadata when present. `structuredContent` is only emitted when `STRUCTURED_CONTENT_ENABLED` is truthy and is **disabled by default**.
- **Regex Pattern**: `/thread\s*id\s*:\s*([a-zA-Z0-9_-]+)/i`
- **Structured Output**: The codex tool advertises an `outputSchema` for `structuredContent` (currently `threadId`) when enabled.

## Features Not Yet Supported

The following Codex CLI features are not currently exposed through the MCP server:

| Feature | CLI Flag | Notes |
|---------|----------|-------|
| Image Attachments | `-i, --image` | Attach images to prompts |
| OSS/Local Models | `--oss`, `--local-provider` | LMStudio/Ollama support |
| Config Profiles | `-p, --profile` | Named configuration profiles |
| Approval Policy | `-a, --ask-for-approval` | Fine-grained approval control |
| Web Search | `--search` | Enable web search tool |
| Additional Dirs | `--add-dir` | Extra writable directories |
| JSON Output | `--json` | JSONL event stream output |
| Output Schema | `--output-schema` | Structured JSON output |
| Output File | `-o, --output-last-message` | Write response to file |

These features may be added in future versions based on user demand.

## MCP Callback URI (v0.81.0+)
Codex CLI added static MCP callback URI support. This MCP server forwards the callback URI via environment variable when provided.

- **Env Var**: `CODEX_MCP_CALLBACK_URI`
- **MCP Parameter**: `callbackUri` (takes precedence over the env var)

## Implementation Details

### Command Construction (v0.75.0+)

**IMPORTANT**: All `exec` options (`--model`, `-c`, `--skip-git-repo-check`, `-C`, `--sandbox`, `--full-auto`) must come BEFORE subcommands (`resume`).

```typescript
// Basic execution (v0.75.0+)
['exec', '--model', selectedModel, '--skip-git-repo-check', prompt]

// Execution with new parameters (v0.75.0+)
['exec', '--model', selectedModel, '--sandbox', 'workspace-write', '--full-auto', '-C', workingDir, '--skip-git-repo-check', prompt]

// Resume mode (v0.75.0+) - All exec options BEFORE 'resume' subcommand
['exec', '--skip-git-repo-check', '-c', 'model="modelName"', '-c', 'model_reasoning_effort="high"', 'resume', conversationId, prompt]

// Code review (v0.75.0+)
['-C', workingDir, 'review', '-c', 'model="modelName"', '--uncommitted', '--base', 'main', prompt]

// Code review with model config before subcommand (also accepted)
['-C', workingDir, '-c', 'model="modelName"', 'review', '--uncommitted', '--base', 'main', prompt]
```

**Important: Resume Mode Limitations**

The `codex exec resume` subcommand has a **limited set of flags** compared to `codex exec`:
- ✅ `-c, --config` - Configuration overrides (use for model selection)
- ✅ `--enable/--disable` - Feature toggles
- ❌ `--model` - Not available (use `-c model="..."` instead)
- ❌ `--sandbox` - Not available in resume mode
- ❌ `--full-auto` - Not available in resume mode
- ❌ `-C` - Not available in resume mode
- ⚠️ `--skip-git-repo-check` - Must be placed on `exec` command BEFORE `resume` subcommand

**Important: Review Mode Limitations**

The `codex review` subcommand also has limited flags:
- ✅ `-c, --config` - Configuration overrides (use for model selection)
- ✅ `--uncommitted`, `--base`, `--commit`, `--title` - Review-specific flags
- ✅ `--enable/--disable` - Feature toggles
- ❌ `--model` - Not available (use `-c model="..."` instead)
- ❌ `--sandbox` - Not available in review mode
- ❌ `--full-auto` - Not available in review mode
- ✅ `-C` - Global option before `review`
- ⚠️ `-c` is accepted by `codex review` and can also be passed before `review` as a global option

**Key Changes in v0.75.0:**
- Added: `codex review` subcommand for code reviews
- Added: `--sandbox` flag for sandbox modes (exec only)
- Added: `--full-auto` flag for automatic execution (exec only)
- Changed: `codex resume` moved to `codex exec resume`
- Note: Resume subcommand and review command have limited flag support

**Key Changes in v0.50.0:**
- Added: `--skip-git-repo-check` flag (exec only)
- Changed: `--reasoning-effort` to `-c model_reasoning_effort=<level>`

### Conversation ID Extraction
```typescript
const conversationIdMatch = result.stderr?.match(/conversation\s*id\s*:\s*([a-zA-Z0-9-]+)/i);
if (conversationIdMatch) {
  sessionStorage.setCodexConversationId(sessionId, conversationIdMatch[1]);
}
```

### Error Handling Enhancements
- **Authentication Errors**: Clear messaging for login requirement
- **Model Validation**: Graceful handling of invalid model names
- **Network Issues**: Proper error propagation and user feedback
- **CLI Availability**: Detection of missing Codex CLI installation

## Migration Guide

### For Existing Users (Upgrading to v0.75.0+)
1. **Check Current Version**:
   ```bash
   codex --version
   ```

2. **Update Codex CLI** (if below v0.75.0):
   ```bash
   npm update -g @openai/codex
   # or
   brew upgrade codex
   ```

3. **Verify Version** (must be v0.75.0 or later):
   ```bash
   codex --version  # Should show v0.75.0 or higher
   ```

4. **Test New Features**:
   ```bash
   # Test code review
   codex review --uncommitted

   # Test sandbox mode
   codex exec --sandbox workspace-write --skip-git-repo-check "list files"
   ```

### For New Users
1. **Install Codex CLI** (v0.75.0+):
   ```bash
   npm install -g @openai/codex
   # or
   brew install codex
   ```

2. **Verify Version**:
   ```bash
   codex --version  # Must be v0.75.0 or later
   ```

3. **Authenticate**:
   ```bash
   codex login --api-key "your-openai-api-key"
   ```

4. **Configure (Optional)**:
   ```bash
   # Edit ~/.codex/config.toml to set preferences
   # Example:
   # model = "gpt-5.2-codex"
   # model_reasoning_effort = "medium"
   ```

5. **Test Setup**:
   ```bash
   codex exec --skip-git-repo-check "console.log('Hello, Codex!')"
   ```

## Performance Optimizations

### Smart Model Selection
- **Default to gpt-5.2-codex**: Optimal for agentic coding without configuration
- **Context-Aware Suggestions**: Better model recommendations based on task type
- **Consistent Experience**: Same model across session interactions

### Efficient Context Management
- **Native Resume Priority**: Use Codex's built-in conversation continuity
- **Fallback Context**: Only when native resume unavailable
- **Token Optimization**: Minimal context overhead for better performance

### Error Recovery
- **Graceful Degradation**: Continue operation despite CLI issues
- **Automatic Retry**: For transient network issues
- **Clear Error Messages**: Actionable feedback for user troubleshooting

## Testing Strategy

### Integration Testing
- **CLI Command Validation**: Verify correct parameter passing
- **Conversation ID Extraction**: Test various output formats
- **Error Scenario Handling**: Comprehensive failure mode coverage

### Edge Case Coverage
- **Malformed CLI Output**: Handle unexpected response formats
- **Network Interruptions**: Graceful handling of connectivity issues
- **Model Availability**: Handle model deprecation or unavailability

## Best Practices

### For Developers
- **Always specify model explicitly** when behavior consistency is critical
- **Use appropriate reasoning effort** based on task complexity
- **Implement proper error handling** for CLI interactions
- **Monitor session lifecycle** to prevent memory leaks

### For Users
- **Start with default settings** for optimal experience
- **Use sessions for complex tasks** requiring multiple interactions
- **Choose reasoning effort wisely** to balance speed and quality
- **Keep CLI updated** for latest features and bug fixes

## Troubleshooting

### Common Issues
1. **Authentication Failures**
   - Solution: Run `codex login --api-key "your-key"`
   - Verify: Check `CODEX_HOME/auth.json` exists

2. **Model Not Available**
   - Solution: Use default `gpt-5.2-codex` or try alternative models
   - Check: Codex CLI documentation for available models

3. **Resume Functionality Not Working**
   - Solution: System falls back to manual context building
   - Check: Conversation ID extraction in server logs

4. **Performance Issues**
   - Solution: Lower reasoning effort or use faster models
   - Monitor: Response times and adjust parameters accordingly