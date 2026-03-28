/**
 * Parse Airflow API log response into readable string format
 * Handles various response formats from both API v1 and v2
 */
export function parseLogResponse(response: any): string {
  if (!response) {
    return '';
  }

  // If response is already a string, check if it needs newline processing
  if (typeof response === 'string') {
    // Replace escaped newlines with actual newlines
    return response.replace(/\\n/g, '\n');
  }

  // Handle v2 API response (dictionary format with numbered keys)
  // Example: { "1": "{\"timestamp\":\"...\",\"event\":\"...\",\"level\":\"...\"}", "2": "..." }
  if (typeof response === 'object' && !Array.isArray(response)) {
    // Check if it's a dictionary with numeric keys
    const keys = Object.keys(response);
    if (keys.length > 0 && keys.every(k => !isNaN(Number(k)))) {
      // Sort keys numerically and process each line
      return keys
        .sort((a, b) => Number(a) - Number(b))
        .map(key => {
          const line = String(response[key]);
          // Try to parse as JSON log entry
          try {
            const logEntry = JSON.parse(line);
            if (logEntry.timestamp && logEntry.event) {
              // Format: [timestamp] [level] event
              const timestamp = logEntry.timestamp || '';
              const level = (logEntry.level || 'info').toUpperCase();
              const event = logEntry.event || '';
              return `[${timestamp}] [${level}] ${event}`;
            }
          } catch {
            // Not JSON, return as-is with newline processing
            return line.replace(/\\n/g, '\n');
          }
          return line.replace(/\\n/g, '\n');
        })
        .join('\n');
    }
    
    // Handle response with content property
    if (response.content) {
      // Content is a string
      if (typeof response.content === 'string') {
        return response.content.replace(/\\n/g, '\n');
      }

      // Content is an array of log entries
      if (Array.isArray(response.content)) {
        return response.content.map((entry: any) => {
          if (typeof entry === 'string') {
            return entry.replace(/\\n/g, '\n');
          }
          // Entry is [timestamp, message] tuple
          if (Array.isArray(entry)) {
            return entry.join(' ').replace(/\\n/g, '\n');
          }
          // Entry is an object with message/content
          const text = entry.message || entry.content || JSON.stringify(entry);
          return String(text).replace(/\\n/g, '\n');
        }).join('\n');
      }
    }
  }

  // Handle v1 API response (array format)
  // Example: [["2024-01-01", "Log line 1"], ["2024-01-01", "Log line 2"]]
  // Or tuple format: [("host", "message"), ...]
  if (Array.isArray(response)) {
    return response.map((entry: any) => {
      if (typeof entry === 'string') {
        return entry.replace(/\\n/g, '\n');
      }
      // Entry is [timestamp, message] or [host, message] tuple
      if (Array.isArray(entry)) {
        // If second element looks like a log message (multi-line or has log markers), use only that
        if (entry.length === 2 && typeof entry[1] === 'string' && 
            (entry[1].includes('\\n') || entry[1].includes('***') || entry[1].includes('['))) {
          return entry[1].replace(/\\n/g, '\n');
        }
        // Otherwise join with space
        return entry.join(' ').replace(/\\n/g, '\n');
      }
      // Entry is an object with message/content
      const text = entry.message || entry.content || JSON.stringify(entry);
      return String(text).replace(/\\n/g, '\n');
    }).join('\n');
  }

  // Fallback: stringify the response
  return JSON.stringify(response, null, 2);
}
