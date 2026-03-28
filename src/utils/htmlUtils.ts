/**
 * HTML escaping and sanitization utilities for webviews
 * Prevents XSS attacks by escaping special characters
 */

/**
 * Escape HTML special characters for safe display in HTML content
 * @param value Any value to escape
 * @returns Escaped string safe for HTML content
 */
export function escapeHtml(value: any): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Escape value for use in HTML attributes
 * @param value Any value to escape
 * @returns Escaped string safe for HTML attributes
 */
export function escapeAttribute(value: any): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '');
}

/**
 * Escape value for use in JavaScript strings
 * @param value Any value to escape
 * @returns Escaped string safe for JavaScript
 */
export function escapeJavaScript(value: any): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Sanitize URL to prevent javascript: and data: URIs
 * @param url URL to sanitize
 * @returns Safe URL or empty string if dangerous
 */
export function sanitizeUrl(url: string): string {
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) {
    return '';
  }
  return url;
}

/**
 * Create safe HTML from template literal
 * @param strings Template strings
 * @param values Values to escape
 * @returns Safe HTML string
 */
export function html(strings: TemplateStringsArray, ...values: any[]): string {
  let result = strings[0];
  for (let i = 0; i < values.length; i++) {
    result += escapeHtml(values[i]) + strings[i + 1];
  }
  return result;
}
