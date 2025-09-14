export function makeRunId(): string {
  return (
    (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) +
    Date.now().toString(36)
  );
}

export function sanitizePrompt(prompt: string): string {
  // Remove dangerous shell characters and trim
  let sanitized = String(prompt ?? '')
    .replace(/[\r\n\t]/g, ' ')
    .trim();
  sanitized = sanitized.replace(/&&/g, '').replace(/rm -rf/g, '');
  return sanitized;
}

export function buildPromptWithSentinels(
  runId: string,
  stitchedContext: string | null,
  userPrompt: string
): string {
  const ctx =
    stitchedContext && stitchedContext.trim().length
      ? [
          `<<CTX:${runId}:START>>`,
          stitchedContext.trim(),
          `<<CTX:${runId}:END>>`,
        ].join('\n')
      : '';
  const usr = [
    `<<USR:${runId}:START>>`,
    userPrompt.trim(),
    `<<USR:${runId}:END>>`,
  ].join('\n');

  return [
    ctx,
    'You are continuing a coding session. Use the context if present,',
    'but do NOT repeat or quote the context or the user prompt. Provide ONLY the answer.',
    `Begin your answer AFTER the line: <<ANS:${runId}:START>>`,
    usr,
    `<<ANS:${runId}:START>>`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function stripEchoesAndMarkers(
  runId: string,
  stitchedContext: string | null,
  raw: string
): string {
  let out = raw ?? '';
  const ansMarker = `<<ANS:${runId}:START>>`;
  const ansIdx = out.indexOf(ansMarker);
  if (ansIdx >= 0) out = out.slice(ansIdx + ansMarker.length);

  const reBlocks = new RegExp(
    [
      String.raw`<<CTX:${runId}:START>>[\s\S]*?<<CTX:${runId}:END>>`,
      String.raw`<<USR:${runId}:START>>[\s\S]*?<<USR:${runId}:END>>`,
    ].join('|'),
    'g'
  );
  out = out.replace(reBlocks, '');

  const reMarkers = new RegExp(
    String.raw`<<(?:CTX|USR|ANS):${runId}:(?:START|END)>>`,
    'g'
  );
  out = out.replace(reMarkers, '');

  if (stitchedContext && stitchedContext.trim()) {
    const esc = stitchedContext.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(esc, 'g'), '');
  }

  return out.trimStart();
}
