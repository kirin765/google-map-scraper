import { createIsoTimestamp, safeTrim } from '../types/shared.js';
import type { CdpSessionLike } from '../types/shared.js';

export interface CdpResponseRecord {
  requestId: string;
  url: string;
  status: number | null;
  mimeType: string | null;
  body: string | null;
  base64Encoded: boolean;
  timestamp: string;
}

export interface CdpRecorder {
  responses: CdpResponseRecord[];
  stop(): Promise<CdpResponseRecord[]>;
}

interface ResponseMeta {
  requestId: string;
  url: string;
  status: number | null;
  mimeType: string | null;
  body: string | null;
  base64Encoded: boolean;
}

export async function createCdpRecorder(
  session: CdpSessionLike,
  options: {
    filter?: (response: CdpResponseRecord) => boolean;
  } = {}
): Promise<CdpRecorder> {
  await session.send('Network.enable');

  const responses: CdpResponseRecord[] = [];
  const responseMap = new Map<string, ResponseMeta>();
  const pending: Array<Promise<void>> = [];

  session.on('Network.responseReceived', (payload) => {
    const event = payload as Record<string, any>;
    const requestId = safeTrim(event?.requestId);
    const response = event?.response as Record<string, any> | undefined;
    if (!requestId || !response) {
      return;
    }

    responseMap.set(requestId, {
      requestId,
      url: safeTrim(response.url) ?? '',
      status: typeof response.status === 'number' ? response.status : null,
      mimeType: safeTrim(response.mimeType) ?? null,
      body: null,
      base64Encoded: false,
    });
  });

  session.on('Network.loadingFinished', (payload) => {
    const event = payload as Record<string, any>;
    const requestId = safeTrim(event?.requestId);
    if (!requestId) {
      return;
    }

    const meta = responseMap.get(requestId);
    if (!meta) {
      return;
    }

    pending.push(
      (async () => {
        try {
          const bodyResponse = (await session.send('Network.getResponseBody', { requestId })) as {
            body?: string;
            base64Encoded?: boolean;
          };

          meta.body = safeTrim(bodyResponse?.body) ?? null;
          meta.base64Encoded = Boolean(bodyResponse?.base64Encoded);

          const record: CdpResponseRecord = {
            requestId: meta.requestId,
            url: meta.url,
            status: meta.status,
            mimeType: meta.mimeType,
            body: meta.body,
            base64Encoded: meta.base64Encoded,
            timestamp: createIsoTimestamp(),
          };

          if (!options.filter || options.filter(record)) {
            responses.push(record);
          }
        } catch {
          // CDP body capture is best-effort. The network response metadata is still preserved.
        }
      })()
    );
  });

  return {
    responses,
    async stop(): Promise<CdpResponseRecord[]> {
      await Promise.allSettled(pending);
      await session.detach?.();
      return responses;
    },
  };
}

export async function captureJsonResponses(
  session: CdpSessionLike,
  run: () => Promise<void>,
  options: {
    filter?: (response: CdpResponseRecord) => boolean;
  } = {}
): Promise<CdpResponseRecord[]> {
  const recorder = await createCdpRecorder(session, options);
  let responses: CdpResponseRecord[] = [];

  try {
    await run();
  } finally {
    responses = await recorder.stop();
  }

  return responses;
}
