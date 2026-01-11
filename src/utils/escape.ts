/**
 * Escape an argument for Windows shell (cmd.exe) to prevent injection attacks.
 * Note: This is only used for arguments, not for the command itself.
 * The command (file) should be a simple executable name without special characters.
 *
 * Handles:
 * - Newlines: replaced with spaces (cmd.exe treats \n as command separator)
 * - Percent signs: escaped as %% to prevent env var expansion
 * - Arguments with spaces/special chars: wrapped in double quotes
 * - Internal quotes: doubled ("") per cmd.exe convention
 *
 * @param arg - The argument to escape
 * @returns The escaped argument safe for cmd.exe
 */
export function escapeArgForWindowsShell(arg: string): string {
  // Replace newlines with spaces - cmd.exe interprets \n as command separator
  let escaped = arg.replace(/[\r\n]+/g, ' ');

  // Escape percent signs to prevent environment variable expansion
  escaped = escaped.replace(/%/g, '%%');

  // Check if we need to wrap in quotes (has spaces or special shell chars)
  // but not if it's already a simple flag like --flag or -x
  const needsQuotes = /[\s&|<>^]/.test(escaped);

  if (needsQuotes) {
    // Escape internal double quotes using CMD-style doubling
    escaped = `"${escaped.replace(/"/g, '""')}"`;
  } else if (escaped.includes('"')) {
    // Has quotes but no spaces - escape quotes with caret for cmd.exe
    escaped = escaped.replace(/"/g, '^"');
  }

  return escaped;
}
