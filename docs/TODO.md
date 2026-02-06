# Codex MCP Server - TODO

## Features from Codex CLI v0.98.0

These features were introduced/stabilized in Codex CLI v0.98.0 but are not yet implemented in this MCP server.

### High Priority

#### [ ] Steer Mode Support
- **Status**: Stable & enabled by default in Codex CLI v0.98.0
- **Description**: Allow redirecting agents during execution without stopping them
- **CLI Flag**: `--steer` (now default)
- **Implementation Notes**:
  - Add `steerMode` parameter to CodexToolSchema
  - Pass `--steer` flag to codex exec commands
  - Consider whether MCP needs to handle streaming input for steering
- **Reference**: [v0.98.0 Release Notes](https://github.com/openai/codex/releases/tag/rust-v0.98.0)

### Medium Priority

#### [ ] Collaboration Mode
- **Status**: Naming unified in v0.98.0
- **Description**: Multi-agent parallel collaboration support
- **Implementation Notes**:
  - Add `collaborationMode` parameter (enum: `none`, `collaborate`)
  - Update command flags accordingly
- **Reference**: Collaboration mode naming synced across prompts, tools, and TUI

#### [ ] Enhanced Structured Content
- **Status**: Text + image content items for dynamic tool outputs in v0.98.0
- **Description**: Better support for dynamic tool outputs with mixed content
- **Implementation Notes**:
  - Current `structuredContent` support is partial
  - May need enhancement to handle text + image content items
- **Reference**: #10567

### Low Priority

#### [ ] Personality Mode
- **Status**: Pragmatic restored as default in v0.98.0
- **Description**: Control Codex's response personality
- **Options**: `pragmatic` (default), `verbose`
- **CLI Config**: `personality = "pragmatic"` or `personality = "verbose"`
- **Implementation Notes**:
  - Add `personality` parameter to CodexToolSchema
  - Pass via `-c personality="..."`
- **Reference**: #10705

---

## Implemented in v1.3.4+

### ✅ GPT-5.3-Codex Model
- **Status**: Implemented
- **Description**: New default model
- **Changes**:
  - Updated `DEFAULT_CODEX_MODEL` constant to `'gpt-5.3-codex'`
  - Updated tool definitions to reflect new default
  - Single source of truth for model updates

### ✅ Reasoning Effort: 'none' and 'xhigh'
- **Status**: Implemented (commit 448fa3c)
- **Description**: Extended reasoning effort options
- **Changes**:
  - Added `'none'` and `'xhigh'` to reasoningEffort enum
  - Full range: `none`, `minimal`, `low`, `medium`, `high`, `xhigh`

---

## Future Considerations

### Model Version Management
- Consider adding a `getAvailableModels()` tool to query Codex CLI for available models
- This would make the server more resilient to future model additions

### Configuration File Support
- Codex CLI supports config files (`.codexrc.toml`)
- Consider whether MCP server should expose config file options

### Streaming Support
- Codex CLI supports SSE streaming for responses
- Consider adding streaming support for long-running tasks

---

## References

- [Codex CLI Releases](https://github.com/openai/codex/releases)
- [Codex Changelog](https://developers.openai.com/codex/changelog/)
- [v0.98.0 Release](https://github.com/openai/codex/releases/tag/rust-v0.98.0)
