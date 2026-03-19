export class DateUtils {
  static toISODateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  static toISODateTimeString(date: Date): string {
    return date.toISOString().replace('T', ' ').split('.')[0];
  }

  static getDuration(startDate: Date, endDate: Date): string {
    const diff = endDate.getTime() - startDate.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  static isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) {
      return false;
    }
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }
}

export class JsonUtils {
  static isValid(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  static parse<T>(str: string, defaultValue: T): T {
    try {
      return JSON.parse(str) as T;
    } catch {
      return defaultValue;
    }
  }
}
