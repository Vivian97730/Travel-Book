function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function handleRequest(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (request.method === "GET" && pathname.endsWith("/health")) {
    return json({ service: "travel-book-api", status: "ok" }, 200);
  }

  return json({
    error: {
      code: "RESOURCE_NOT_FOUND",
      message: "找不到指定的介面。",
      requestId: crypto.randomUUID(),
      details: {},
    },
  }, 404);
}
