// Runs a dedicated module Worker, posts one message and resolves with its first reply.
export function runWorker<T>(
  url: URL,
  message?: unknown,
  transfer: Transferable[] = [],
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const worker = new Worker(url, { type: 'module' });
    worker.onmessage = (event: MessageEvent<T>) => {
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (event: ErrorEvent) => {
      worker.terminate();
      reject(new Error(`worker error: ${event.message}`));
    };
    if (message !== undefined) worker.postMessage(message, transfer);
  });
}
