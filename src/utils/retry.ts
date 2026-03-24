export interface RetryOptions {
  attempts: number;
  delayMs: number;
  factor?: number;
  maxDelayMs?: number;
  jitterMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export function computeRetryDelay(attempt: number, options: Pick<RetryOptions, 'delayMs' | 'factor' | 'maxDelayMs' | 'jitterMs'>): number {
  const factor = options.factor ?? 2;
  const baseDelay = options.delayMs * Math.pow(factor, Math.max(0, attempt - 1));
  const maxDelay = options.maxDelayMs ?? Number.POSITIVE_INFINITY;
  const bounded = Math.min(baseDelay, maxDelay);
  const jitter = options.jitterMs ?? 0;

  if (jitter <= 0) {
    return Math.max(0, Math.round(bounded));
  }

  const randomOffset = (Math.random() - 0.5) * jitter * 2;
  return Math.max(0, Math.round(bounded + randomOffset));
}

export async function retry<T>(operation: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  if (!Number.isInteger(options.attempts) || options.attempts < 1) {
    throw new Error('Retry attempts must be at least 1.');
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;

      const canRetry = attempt < options.attempts && (options.shouldRetry?.(error, attempt) ?? true);
      if (!canRetry) {
        throw error;
      }

      const delayMs = computeRetryDelay(attempt, options);
      options.onRetry?.(error, attempt, delayMs);
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Retry operation failed.');
}
