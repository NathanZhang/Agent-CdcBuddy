const encoder = new TextEncoder();
export const SSE_HEARTBEAT_MS = 15_000;

/** Transport comments keep proxies active without manufacturing model progress. */
export function heartbeatSseResponse(
  produce: (send: (bytes: Uint8Array) => void, signal: AbortSignal) => Promise<void>,
  callerSignal?: AbortSignal,
  options: {drainOnAbort?: boolean} = {},
): Response {
  const cancellation = new AbortController();
  let stop = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (bytes: Uint8Array) => { if (!closed && !cancellation.signal.aborted) controller.enqueue(bytes); };
      const timer = setInterval(() => send(encoder.encode(': heartbeat\n\n')), SSE_HEARTBEAT_MS);
      const cleanup = () => {
        clearInterval(timer);
        callerSignal?.removeEventListener('abort', onAbort);
      };
      const finish = (error?: unknown) => {
        if (closed) return;
        closed = true;
        cleanup();
        if (error !== undefined) controller.error(error);
        else controller.close();
      };
      const onAbort = () => {
        cancellation.abort(callerSignal?.reason);
        cleanup();
        // Agent turns must finish journaling their interrupted state before EOF.
        if (!options.drainOnAbort) finish();
      };
      stop = () => {
        if (closed) return;
        closed = true;
        cleanup();
        cancellation.abort();
      };
      callerSignal?.addEventListener('abort', onAbort, {once: true});
      if (callerSignal?.aborted) { onAbort(); finish(); return; }
      send(encoder.encode(': connected\n\n'));
      // Do not hold start() open: reader cancellation must work during a stalled task.
      void Promise.resolve().then(() => {
        cancellation.signal.throwIfAborted();
        return produce(send, cancellation.signal);
      }).then(() => finish(), error => { if (!closed) finish(cancellation.signal.aborted ? undefined : error); });
    },
    cancel() { stop(); },
  });
  return new Response(stream, {headers: {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  }});
}
