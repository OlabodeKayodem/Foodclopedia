import { type ChatResponse, type ChatRequestOptions, type ChatResponseChunk } from './models.js';

export const apiBaseUrl = import.meta.env.VITE_APP_BACKEND_API_URI || '';

export async function getCompletion(options: ChatRequestOptions) {
  const apiUrl = options.apiUrl || apiBaseUrl;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages: options.messages }),
  });

  if (options.stream) {
    return getChunksFromResponse<ChatResponseChunk>(response as Response, options.chunkIntervalMs);
  }

  const json: ChatResponse = await response.json();
  if (response.status > 299 || !response.ok) {
    throw new Error(json.error || 'Unknown error');
  }

  return json;
}

export function getCitationUrl(citation: string): string {
  return `${apiBaseUrl}/content/${citation}`;
}

export class NdJsonParserStream extends TransformStream<string, JSON> {
  private buffer: string = '';
  constructor() {
    let controller: TransformStreamDefaultController<JSON>;
    super({
      start: (_controller) => {
        controller = _controller;
      },
      transform: (chunk) => {
        const jsonChunks = chunk.split('\n').filter(Boolean);
        for (const jsonChunk of jsonChunks) {
          try {
            this.buffer += jsonChunk;
            controller.enqueue(JSON.parse(this.buffer));
            this.buffer = '';
          } catch {
            // Invalid JSON, wait for next chunk
          }
        }
      },
    });
  }
}

export async function* getChunksFromResponse<T>(response: Response, intervalMs: number): AsyncGenerator<T, void> {
  const reader = response.body?.pipeThrough(new TextDecoderStream()).pipeThrough(new NdJsonParserStream()).getReader();
  if (!reader) {
    throw new Error('No response body or body is not readable');
  }

  let value: JSON | undefined;
  let done: boolean;
  while ((({ value, done } = await reader.read()), !done)) {
    yield new Promise<T>((resolve) => {
      setTimeout(() => {
        resolve(value as T);
      }, intervalMs);
    });
  }
}
