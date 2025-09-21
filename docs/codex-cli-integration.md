# Codex CLI v0.36.0+ Integration Guide

## Overview
This document outlines the integration with OpenAI Codex CLI v0.36.0+, highlighting breaking changes, new features, and implementation details for the MCP server wrapper.

## Breaking Changes ⚠️

### Authentication Method Change
- **Old Method**: `OPENAI_API_KEY` environment variable
- **New Method**: `codex login --api-key "your-api-key"`
- **Storage**: Credentials now stored in `CODEX_HOME/auth.json`
- **Impact**: Users must re-authenticate using the new login command

## New Features Implemented

### 1. Model Selection
- **Default Model**: `gpt-5-codex` (optimal for coding tasks)
- **CLI Flag**: `--model <model-name>`
- **Supported Models**:
  - `gpt-5-codex` (default, specialized for coding)
  - `gpt-4` (advanced reasoning)
  - `gpt-3.5-turbo` (fast responses)
- **Usage**: Model parameter available in both `exec` and `resume` modes

### 2. Reasoning Effort Control
- **CLI Flag**: `--reasoning-effort <level>`
- **Levels**:
  - `low`: Quick responses, minimal processing
  - `medium`: Balanced response quality and speed
  - `high`: Thorough analysis, comprehensive responses
- **Use Cases**:
  - Low: Simple syntax questions, quick fixes
  - Medium: Code reviews, standard debugging
  - High: Complex architectural analysis, optimization

### 3. Native Resume Functionality
- **Command**: `codex resume <conversation-id>`
- **Automatic ID Extraction**: Server extracts conversation IDs from CLI output
- **Regex Pattern**: `/conversation\s*id\s*:\s*([a-zA-Z0-9-]+)/i`
- **Fallback Strategy**: Manual context building when resume unavailable
- **Session Integration**: Seamless integration with session management

## Implementation Details

### Command Construction
```typescript
// Basic execution
['exec', '--model', selectedModel, '--reasoning-effort', effort, prompt]

// Resume with parameters
['resume', conversationId, '--model', selectedModel, '--reasoning-effort', effort, prompt]
```

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

### For Existing Users
1. **Update Codex CLI**: Ensure version 0.36.0 or later
2. **Re-authenticate**: Run `codex login --api-key "your-key"`
3. **Update Environment**: Remove `OPENAI_API_KEY` environment variable
4. **Test Installation**: Verify with `codex --help`

### For New Users
1. **Install Codex CLI**:
   ```bash
   npm install -g @openai/codex
   # or
   brew install codex
   ```
2. **Authenticate**:
   ```bash
   codex login --api-key "your-openai-api-key"
   ```
3. **Verify Setup**:
   ```bash
   codex exec "console.log('Hello, Codex!')"
   ```

## Performance Optimizations

### Smart Model Selection
- **Default to gpt-5-codex**: Optimal for coding without configuration
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
   - Solution: Use default `gpt-5-codex` or try alternative models
   - Check: Codex CLI documentation for available models

3. **Resume Functionality Not Working**
   - Solution: System falls back to manual context building
   - Check: Conversation ID extraction in server logs

4. **Performance Issues**
   - Solution: Lower reasoning effort or use faster models
   - Monitor: Response times and adjust parameters accordingly