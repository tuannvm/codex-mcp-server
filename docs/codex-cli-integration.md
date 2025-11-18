# Codex CLI v0.50.0+ Integration Guide

## Overview
This document outlines the integration with OpenAI Codex CLI v0.50.0+, highlighting breaking changes, new features, and implementation details for the MCP server wrapper.

## Version Compatibility

### Minimum Version: v0.50.0
This MCP server **requires codex CLI v0.50.0 or later** due to critical flag changes.

**Version History:**
- **v0.50.0**: Introduced `--skip-git-repo-check` flag, removed `--reasoning-effort` flag
- **v0.36.0-v0.49.x**: Not compatible with this MCP server version (use older MCP releases)

## Breaking Changes ⚠️

### v0.50.0 Changes (Current)
1. **`--skip-git-repo-check` flag now required**
   - Required when running outside git repositories or in untrusted directories
   - Prevents "Not inside a trusted directory" errors
   - Impact: All MCP server commands now include this flag

2. **`--reasoning-effort` flag removed**
   - The flag no longer exists in codex CLI v0.50.0
   - MCP server `reasoningEffort` parameter is now ignored
   - Impact: Reasoning effort configuration moved to codex CLI's own config

### v0.36.0 Changes (Historical)
1. **Authentication Method Change**
   - **Old Method**: `OPENAI_API_KEY` environment variable
   - **New Method**: `codex login --api-key "your-api-key"`
   - **Storage**: Credentials now stored in `CODEX_HOME/auth.json`
   - **Impact**: Users must re-authenticate using the new login command

## New Features Implemented

### 1. Model Selection
- **Default Model**: `gpt-5.1-codex` (optimal for coding tasks)
- **CLI Flag**: `--model <model-name>`
- **Supported Models**:
  - `gpt-5.1-codex` (default, specialized for coding)
  - `gpt-4` (advanced reasoning)
  - `gpt-3.5-turbo` (fast responses)
- **Usage**: Model parameter available in both `exec` and `resume` modes

### 2. Reasoning Effort Control (Deprecated in v0.50.0)
- **Status**: ⚠️ Removed in codex CLI v0.50.0
- **Previous Flag**: `--reasoning-effort <level>` (no longer supported)
- **Current Configuration**: Set reasoning effort in `~/.codex/config.toml`:
  ```toml
  model_reasoning_effort = "medium"  # Options: low, medium, high
  ```
- **MCP Parameter**: The `reasoningEffort` parameter in MCP tool calls is now **ignored**
- **Migration**: Users should configure reasoning effort directly in codex CLI config

### 3. Native Resume Functionality
- **Command**: `codex resume <conversation-id>`
- **Automatic ID Extraction**: Server extracts conversation IDs from CLI output
- **Regex Pattern**: `/conversation\s*id\s*:\s*([a-zA-Z0-9-]+)/i`
- **Fallback Strategy**: Manual context building when resume unavailable
- **Session Integration**: Seamless integration with session management

## Implementation Details

### Command Construction (v0.50.0+)
```typescript
// Basic execution (v0.50.0+)
['exec', '--model', selectedModel, '--skip-git-repo-check', prompt]

// Resume with parameters (v0.50.0+)
['resume', conversationId, '--model', selectedModel, '--skip-git-repo-check', prompt]

// Old command structure (v0.36.0-v0.49.x) - NO LONGER SUPPORTED
// ['exec', '--model', selectedModel, '--reasoning-effort', effort, prompt]
```

**Key Changes in v0.50.0:**
- Added: `--skip-git-repo-check` flag (always included)
- Removed: `--reasoning-effort` flag (configure in `~/.codex/config.toml` instead)

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

### For Existing Users (Upgrading to v0.50.0+)
1. **Check Current Version**:
   ```bash
   codex --version
   ```

2. **Update Codex CLI** (if below v0.50.0):
   ```bash
   npm update -g @openai/codex
   # or
   brew upgrade codex
   ```

3. **Verify Version** (must be v0.50.0 or later):
   ```bash
   codex --version  # Should show v0.50.0 or higher
   ```

4. **Update Reasoning Effort Configuration** (if used):
   ```bash
   # Edit ~/.codex/config.toml
   # Add or update: model_reasoning_effort = "medium"
   ```

5. **Test Installation**:
   ```bash
   codex exec --skip-git-repo-check "console.log('Hello, Codex!')"
   ```

### For New Users
1. **Install Codex CLI** (v0.50.0+):
   ```bash
   npm install -g @openai/codex
   # or
   brew install codex
   ```

2. **Verify Version**:
   ```bash
   codex --version  # Must be v0.50.0 or later
   ```

3. **Authenticate**:
   ```bash
   codex login --api-key "your-openai-api-key"
   ```

4. **Configure (Optional)**:
   ```bash
   # Edit ~/.codex/config.toml to set preferences
   # Example:
   # model = "gpt-5.1-codex"
   # model_reasoning_effort = "medium"
   ```

5. **Test Setup**:
   ```bash
   codex exec --skip-git-repo-check "console.log('Hello, Codex!')"
   ```

## Performance Optimizations

### Smart Model Selection
- **Default to gpt-5.1-codex**: Optimal for coding without configuration
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
   - Solution: Use default `gpt-5.1-codex` or try alternative models
   - Check: Codex CLI documentation for available models

3. **Resume Functionality Not Working**
   - Solution: System falls back to manual context building
   - Check: Conversation ID extraction in server logs

4. **Performance Issues**
   - Solution: Lower reasoning effort or use faster models
   - Monitor: Response times and adjust parameters accordingly