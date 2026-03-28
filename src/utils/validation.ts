/**
 * Input validation and sanitization utilities
 */

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate JSON string
 */
export function isValidJson(str: string): boolean {
  if (!str || str.trim() === '') {
    return true; // Empty is valid (optional)
  }
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize string for safe display (prevent XSS)
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate server name (alphanumeric, spaces, hyphens, underscores)
 */
export function isValidServerName(name: string): boolean {
  return /^[a-zA-Z0-9\s\-_]+$/.test(name) && name.length > 0 && name.length <= 100;
}

/**
 * Validate AWS region format
 */
export function isValidAwsRegion(region: string): boolean {
  return /^[a-z]{2}-[a-z]+-\d{1}$/.test(region);
}

/**
 * Validate environment name (AWS MWAA)
 */
export function isValidEnvironmentName(name: string): boolean {
  return /^[a-zA-Z0-9\-_]+$/.test(name) && name.length > 0 && name.length <= 255;
}

/**
 * Validate variable key (Airflow variables)
 */
export function isValidVariableKey(key: string): boolean {
  return /^[a-zA-Z0-9\-_.]+$/.test(key) && key.length > 0 && key.length <= 250;
}

/**
 * Validate pool/connection name
 */
export function isValidResourceName(name: string): boolean {
  return /^[a-zA-Z0-9\-_.]+$/.test(name) && name.length > 0 && name.length <= 250;
}

/**
 * Validate DAG ID format
 */
export function isValidDagId(dagId: string): boolean {
  return /^[a-zA-Z0-9\-_.]+$/.test(dagId) && dagId.length > 0 && dagId.length <= 250;
}

/**
 * Validate positive integer
 */
export function isPositiveInteger(value: any): boolean {
  const num = parseInt(value, 10);
  return !isNaN(num) && num > 0 && num === parseFloat(value);
}

/**
 * Sanitize error message for user display
 */
export function sanitizeErrorMessage(error: any): string {
  if (!error) {
    return 'Unknown error occurred';
  }
  
  const message = error.message || error.toString();
  
  // Remove sensitive information patterns
  return message
    .replace(/password[=:]\s*[^\s&]+/gi, 'password=***')
    .replace(/token[=:]\s*[^\s&]+/gi, 'token=***')
    .replace(/key[=:]\s*[^\s&]+/gi, 'key=***')
    .replace(/secret[=:]\s*[^\s&]+/gi, 'secret=***');
}
