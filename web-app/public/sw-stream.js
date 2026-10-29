// Service Worker: Direct-to-Disk Stream Interceptor
// Enables stream downloads on browsers lacking File System Access API (Safari, Firefox, Mobile)
// without accumulating GBs in RAM.

const streamRegistry = new Map();

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === "INIT_STREAM") {
    const { streamId, filename, size, mimeType } = data;
    let streamController;

    const stream = new ReadableStream({
      start(controller) {
        streamController = controller;
      },
      cancel() {
        streamRegistry.delete(streamId);
      },
    });

    streamRegistry.set(streamId, {
      stream,
      controller: streamController,
      filename: filename || "download.bin",
      size: size || 0,
      mimeType: mimeType || "application/octet-stream",
    });

    event.ports[0]?.postMessage({ success: true });
  } else if (data.type === "PUSH_CHUNK") {
    const { streamId, chunk } = data;
    const entry = streamRegistry.get(streamId);
    if (entry && entry.controller) {
      entry.controller.enqueue(new Uint8Array(chunk));
    }
  } else if (data.type === "END_STREAM") {
    const { streamId } = data;
    const entry = streamRegistry.get(streamId);
    if (entry && entry.controller) {
      try {
        entry.controller.close();
      } catch (e) {
        // Ignored if already closed
      }
      streamRegistry.delete(streamId);
    }
  } else if (data.type === "ABORT_STREAM") {
    const { streamId } = data;
    const entry = streamRegistry.get(streamId);
    if (entry && entry.controller) {
      try {
        entry.controller.error(new Error("Stream aborted by user"));
      } catch (e) {
        // Ignored
      }
      streamRegistry.delete(streamId);
    }
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith("/download-stream/")) {
    const streamId = url.pathname.replace("/download-stream/", "");
    const entry = streamRegistry.get(streamId);

    if (entry) {
      const headers = new Headers({
        "Content-Type": entry.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(entry.filename)}"`,
      });

      if (entry.size > 0) {
        headers.set("Content-Length", entry.size.toString());
      }

      event.respondWith(
        new Response(entry.stream, {
          headers,
          status: 200,
        })
      );
      return;
    }
  }
});

