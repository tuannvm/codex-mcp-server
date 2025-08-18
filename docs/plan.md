# Codex MCP Server Implementation Plan

## Overview
Create an MCP server wrapper for OpenAI Codex CLI that enables single-command integration with Claude, similar to gemini-mcp-tool.

**Assumption:** Codex CLI is pre-installed and configured on the target system.

## Phase 1: Project Foundation

### Step 1.1: Validate Dependencies
- **Action:** VALIDATE_DEPENDENCY
- **Description:** Verify current MCP SDK version
- **Details:** @modelcontextprotocol/sdk@1.17.3 (validated)
- **Verification:** MCP SDK version 1.17.3 is current and stable

### Step 1.2: Initialize Project
- **Action:** CREATE_FILE
- **Description:** Initialize Node.js project with package.json configuration
- **Details:** `/Users/tuannvm/Projects/cli/codex-mcp-server/package.json` with dependencies: @modelcontextprotocol/sdk, chalk, zod, and devDependencies: typescript, tsx, @types/node
- **Verification:** package.json exists with correct dependencies and bin configuration pointing to dist/index.js

### Step 1.3: TypeScript Configuration
- **Action:** CREATE_FILE
- **Description:** Create TypeScript configuration for ES modules
- **Details:** `/Users/tuannvm/Projects/cli/codex-mcp-server/tsconfig.json` with ES2022 target, module: "ESNext", strict mode enabled
- **Verification:** TypeScript compiles without errors and generates proper ES module output

## Phase 2: Core MCP Server Implementation

### Step 2.1: Main Server Entry Point
- **Action:** CREATE_FILE
- **Description:** Implement main MCP server entry point
- **Details:** `/Users/tuannvm/Projects/cli/codex-mcp-server/src/index.ts` - Server initialization with stdio transport, tool registration, and request handling
- **Verification:** Server starts without errors and responds to MCP list_tools requests

### Step 2.2: Tool Definitions
- **Action:** CREATE_FILE
- **Description:** Define Codex tool interfaces and schemas
- **Details:** `/Users/tuannvm/Projects/cli/codex-mcp-server/src/tools.ts` - Zod schemas for codex, ping, help tools with simple parameter definitions
- **Verification:** Tools are properly registered and expose correct parameter schemas

### Step 2.3: Tool Handlers
- **Action:** CREATE_FILE
- **Description:** Implement tool execution handlers
- **Details:** `/Users/tuannvm/Projects/cli/codex-mcp-server/src/handlers.ts` - Execute codex exec commands via child_process, handle authentication, capture stdout/stderr
- **Verification:** Tool handlers execute codex commands successfully and return proper MCP responses

## Phase 3: Authentication & Error Handling

### Step 3.1: Authentication
- **Action:** APPLY_EDIT
- **Description:** Add basic error handling for authentication
- **Details:** Assume Codex CLI is pre-configured; handle command execution failures gracefully
- **Verification:** Server provides clear error messages when Codex CLI commands fail

### Step 3.2: Error Handling
- **Action:** APPLY_EDIT
- **Description:** Implement error handling and logging
- **Details:** Add comprehensive error handling for command failures, timeouts, and validation errors with chalk-colored output
- **Verification:** All error conditions are properly caught and return meaningful MCP error responses

## Phase 4: Distribution & Documentation

### Step 4.1: NPM Package Configuration
- **Action:** APPLY_EDIT
- **Description:** Configure NPM package for distribution
- **Details:** Update package.json with proper bin entry, files field, keywords, repository, and publish configuration
- **Verification:** Package can be installed via npx and executed as a standalone command

### Step 4.2: Documentation
- **Action:** CREATE_FILE
- **Description:** Create README with installation and usage instructions
- **Details:** `/Users/tuannvm/Projects/cli/codex-mcp-server/README.md` with claude mcp add command, authentication setup, and tool usage examples
- **Verification:** README provides clear setup instructions matching the gemini-mcp-tool pattern

## Phase 5: Build & Testing

### Step 5.1: Build Process
- **Action:** EXECUTE_COMMAND
- **Description:** Build TypeScript project
- **Details:** npm run build
- **Verification:** TypeScript compilation succeeds and generates dist/index.js executable file

### Step 5.2: Local Testing
- **Action:** EXECUTE_COMMAND
- **Description:** Test local execution
- **Details:** node dist/index.js with sample MCP requests to verify tool functionality
- **Verification:** Server responds correctly to list_tools and call_tool requests with proper Codex integration

## Tools to Implement

### Primary Tool: `codex`
- **Purpose:** Execute Codex CLI in non-interactive mode for AI assistance
- **Category:** 'codex'
- **Maps to:** `codex exec "prompt"`
- **Parameters:**
  - `prompt` (required): The coding task, question, or analysis request

### Utility Tool: `ping`
- **Purpose:** Test MCP server connection
- **Category:** 'simple'
- **Parameters:**
  - `message` (optional): Message to echo back (default: "pong")

### Utility Tool: `help`
- **Purpose:** Get Codex CLI help information
- **Category:** 'simple'
- **Maps to:** `codex --help`
- **Parameters:** None

## Command Mapping

### Core Execution Pattern
Each MCP tool call translates directly to:
```bash
codex exec "prompt"
```

### Example Command Generation
```bash
# All requests use the same simple pattern
codex exec "Explain this TypeScript function"
codex exec "Refactor this code for better performance"  
codex exec "Add error handling to this function"
```

## Integration Goal
Enable single-command Claude integration:
```bash
claude mcp add codex-cli -- npx -y codex-mcp-server
```