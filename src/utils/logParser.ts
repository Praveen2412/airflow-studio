/**
 * Parse Airflow API log response into readable string format
 * Handles various response formats from both API v1 and v2
 */
export function parseLogResponse(response: any): string {
  if (!response) {
    return '';
  }

  // If response is already a string, return it
  if (typeof response === 'string') {
    return response;
  }

  // Handle response with content property
  if (response.content) {
    // Content is a string
    if (typeof response.content === 'string') {
      return response.content;
    }

    // Content is an array of log entries
    if (Array.isArray(response.content)) {
      return response.content.map((entry: any) => {
        if (typeof entry === 'string') {
          return entry;
        }
        // Entry is [timestamp, message] tuple
        if (Array.isArray(entry)) {
          return entry.join(' ');
        }
        // Entry is an object with message/content
        return entry.message || entry.content || JSON.stringify(entry);
      }).join('\n');
    }
  }

  // Response is an array of log entries
  if (Array.isArray(response)) {
    return response.map((entry: any) => {
      if (typeof entry === 'string') {
        return entry;
      }
      // Entry is [timestamp, message] tuple
      if (Array.isArray(entry)) {
        return entry.join(' ');
      }
      // Entry is an object with message/content
      return entry.message || entry.content || JSON.stringify(entry);
    }).join('\n');
  }

  // Fallback: stringify the response
  return JSON.stringify(response, null, 2);
}
