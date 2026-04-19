# /codex-setup — Re-sign Codex Computer Use Binary

Re-sign the Codex.app SkyComputerUseClient binary so Claude Code can launch it. Required when the binary has the hardened runtime flag (Apple event error -10000).

## Why This Is Needed

Codex.app ships with a hardened runtime that prevents other processes (like Node.js) from sending it Apple Events. Ad-hoc re-signing removes this restriction. This is **not** a security risk — it only affects your local machine.

**You must re-run this after every Codex.app update.** Auto-updates replace the binary, which resets the signature. If `cu_*` tools suddenly fail with `Apple event error -10000`, re-sign.

## Binary Path

```
/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient
```

## Steps

Follow these steps in order. Run each command and check the output before proceeding.

### 1. Check if Codex.app is installed

```bash
ls "/Applications/Codex.app" &>/dev/null && echo "Codex.app found" || echo "Codex.app NOT found — install from https://codex.ai"
```

If not found, stop and tell the user to install Codex.app first.

### 2. Check the binary exists

```bash
BINARY="/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient"
ls "$BINARY" &>/dev/null && echo "Binary found" || echo "Binary NOT found — Codex.app may need reinstall"
```

### 3. Check current signature status

```bash
BINARY="/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient"
codesign -dvvv "$BINARY" 2>&1 | grep -E 'flags=|Signature|runtime'
```

Look for `flags=0x20002` (or similar with `runtime` bit set) — that means re-signing is needed. If it shows `Signature=adhoc`, it may already be signed.

### 4. Re-sign with ad-hoc signature

Tell the user this requires `sudo` and their password, then run:

```bash
sudo codesign --force --deep --sign - "/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient"
```

If this fails, the binary may be protected by SIP or Codex.app may not be installed properly.

### 5. Verify the signature

```bash
BINARY="/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient"
codesign --verify --deep --strict "$BINARY" 2>&1
```

Expected output: `BINARY: valid on disk` (no errors). Any error means re-signing failed.

### 6. Test the binary responds to JSON-RPC

```bash
BINARY="/Applications/Codex.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}' | timeout 5 "$BINARY" mcp 2>/dev/null | head -1
```

Expected: a JSON-RPC response containing `"serverInfo"`. If no output or error, the binary can't start.

### 7. Confirm success

Tell the user:
- The binary is signed and working
- `cu_*` tools should now work in Claude Code
- **Reminder:** Re-run `/codex-setup` after any Codex.app update (auto-update or manual)
- Consider adding a calendar reminder or note to re-sign after updates

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Apple event error -10000` | Hardened runtime not removed | Re-run step 4 |
| `Binary NOT found` | Codex.app updated and changed path | Reinstall Codex.app |
| `operation not permitted` | SIP or permission issue | Run from an admin terminal |
| No JSON-RPC response in step 6 | Binary crashed on start | Check `/var/log/system.log` for crash reports |
| Works in Terminal but not Claude Code | Claude Code spawns a different process | Restart Claude Code after re-signing |
