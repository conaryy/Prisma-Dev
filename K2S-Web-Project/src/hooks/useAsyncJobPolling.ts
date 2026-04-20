import { useCallback, useEffect, useRef } from 'react';

type AsyncJobPollingOptions<TResponse> = {
  poll: (jobId: string) => Promise<TResponse>;
  isPending: (response: TResponse) => boolean;
  onSuccess: (response: TResponse) => void | Promise<void>;
  onFailure: (response: TResponse) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
  intervalMs?: number;
};

export function useAsyncJobPolling<TResponse>({
  poll,
  isPending,
  onSuccess,
  onFailure,
  onError,
  intervalMs = 3000,
}: AsyncJobPollingOptions<TResponse>) {
  const timeoutRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    async (jobId: string): Promise<void> => {
      try {
        const response = await poll(jobId);

        if (isPending(response)) {
          timeoutRef.current = window.setTimeout(() => {
            void startPolling(jobId);
          }, intervalMs);
          return;
        }

        stopPolling();

        const status = (response as { status?: unknown }).status;
        if (status === 'failed') {
          await onFailure(response);
          return;
        }

        await onSuccess(response);
      } catch (error) {
        stopPolling();

        if (!onError) {
          return;
        }

        await onError(
          error instanceof Error ? error : new Error('Async job polling failed.')
        );
      }
    },
    [intervalMs, isPending, onError, onFailure, onSuccess, poll, stopPolling]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  return {
    startPolling,
    stopPolling,
  };
}
