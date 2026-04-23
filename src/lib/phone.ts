/**
 * Phone number masking utilities for PII protection.
 *
 * Used in account/profile views so phone numbers are not displayed
 * in plain text (shoulder-surfing, screen sharing, screenshot risk).
 * Full numbers are only revealed in editable inputs the user controls.
 */

/**
 * Mask a phone number, keeping only the last `visible` digits visible.
 * Non-digit characters (spaces, dashes, parentheses, +) are preserved
 * in their positions where possible; digits are replaced with •.
 *
 * Examples:
 *   maskPhone("+1 867 988 8836")        => "+• ••• ••• 8836"
 *   maskPhone("8679888836")             => "••••••8836"
 *   maskPhone("(867) 988-8836", 2)      => "(•••) •••-••36"
 *   maskPhone(null)                     => ""
 */
export function maskPhone(
  phone: string | null | undefined,
  visible: number = 4
): string {
  if (!phone) return "";
  const trimmed = String(phone).trim();
  if (!trimmed) return "";

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length <= visible) {
    // Too short to meaningfully mask — return as-is.
    return trimmed;
  }

  const keepFromIndex = digits.length - visible;
  let digitIdx = 0;
  let out = "";
  for (const ch of trimmed) {
    if (/\d/.test(ch)) {
      out += digitIdx >= keepFromIndex ? ch : "•";
      digitIdx += 1;
    } else {
      out += ch;
    }
  }
  return out;
}
