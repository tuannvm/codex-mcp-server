# /codex-setup — Re-sign Codex Computer Use Binary

Re-sign the Codex computer-use binary so Claude Code can launch it. This is needed when the binary has the hardened runtime flag, which prevents exec from a non-signed parent process (like node).

## Steps

1. **Find the binary** — check these locations in order:
   - `$CODEX_COMPUTER_USE_BINARY` env var (if set)
   - `open-computer-use` in PATH (`which open-computer-use`)
   - Codex.app bundled binary at:
     ```
     /Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient
     ```

   Run:
   ```bash
   if [ -n "$CODEX_COMPUTER_USE_BINARY" ]; then
     echo "$CODEX_COMPUTER_USE_BINARY"
   elif command -v open-computer-use &>/dev/null; then
     which open-computer-use
   elif [ -f "/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient" ]; then
     echo "/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient"
   else
     echo "NOT_FOUND"
   fi
   ```

2. **Check current signature** — if the output includes `restricted` or `runtime`, re-signing is needed:
   ```bash
   codesign -dvvv <binary_path> 2>&1 | grep -E 'flags|runtime|Signature'
   ```

3. **Re-sign with ad-hoc signature** — this removes the hardened runtime restriction:
   ```bash
   sudo codesign --force --deep --sign - "<binary_path>"
   ```

4. **Verify** — confirm the new signature:
   ```bash
   codesign --verify --deep --strict <binary_path> 2>&1
   ```

   Expected: `valid on disk` (no errors).

5. **Test the binary** — confirm it starts and speaks JSON-RPC:
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}' | timeout 5 "<binary_path>" mcp 2>/dev/null | head -1
   ```

   Expected: A JSON-RPC response with `"result"` containing `"serverInfo"`.

## Notes

- Requires `sudo` for re-signing (the binary lives in `/Applications`)
- The ad-hoc signature (`-` flag) is machine-local — it won't work if you move the binary to another Mac
- If Codex.app auto-updates, you may need to re-run this command
- The `open-codex-computer-use-mcp` npm package (v0.1.11+) includes a pre-signed binary that may not need this step
