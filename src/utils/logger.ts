import { createIsoTimestamp, normalizeWhitespace } from '../types/shared.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerEntry {
  timestamp: string;
  level: LogLevel;
  scope?: string;
  message: string;
  context: Record<string, unknown>;
}

export interface LoggerOptions {
  level?: LogLevel;
  scope?: string;
  context?: Record<string, unknown>;
  sink?: (entry: LoggerEntry, line: string) => void;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function serializeValue(value: unknown): string {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value === null) {
    return 'null';
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

export function formatLogLine(entry: LoggerEntry): string {
  const pieces = [`${entry.timestamp}`, `[${entry.level}]`];

  if (entry.scope) {
    pieces.push(`[${entry.scope}]`);
  }

  pieces.push(entry.message);

  for (const [key, value] of Object.entries(entry.context)) {
    pieces.push(`${key}=${serializeValue(value)}`);
  }

  return normalizeWhitespace(pieces.join(' '));
}

export function createLogger(options: LoggerOptions = {}): {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(scope: string, context?: Record<string, unknown>): ReturnType<typeof createLogger>;
} {
  const minimumLevel = options.level ?? 'info';
  const baseContext = options.context ?? {};
  const sink = options.sink ?? defaultSink;

  function emit(level: LogLevel, message: string, context: Record<string, unknown> = {}, scope?: string): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minimumLevel]) {
      return;
    }

    const entry: LoggerEntry = {
      timestamp: createIsoTimestamp(),
      level,
      scope: scope ?? options.scope,
      message: normalizeWhitespace(message),
      context: { ...baseContext, ...context },
    };

    sink(entry, formatLogLine(entry));
  }

  return {
    debug(message, context) {
      emit('debug', message, context);
    },
    info(message, context) {
      emit('info', message, context);
    },
    warn(message, context) {
      emit('warn', message, context);
    },
    error(message, context) {
      emit('error', message, context);
    },
    child(scope, context = {}) {
      return createLogger({
        level: minimumLevel,
        scope,
        context: { ...baseContext, ...context },
        sink,
      });
    },
  };
}

function defaultSink(entry: LoggerEntry, line: string): void {
  if (entry.level === 'error' || entry.level === 'warn') {
    console.error(line);
    return;
  }

  console.log(line);
}

export function createSilentLogger(): ReturnType<typeof createLogger> {
  return createLogger({
    level: 'error',
    sink() {
      // Intentionally silent.
    },
  });
}
