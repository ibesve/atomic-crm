const functionMap: Record<string, string> = {
  "merge_contacts": "/home/deno/functions/merge_contacts",
  "postmark": "/home/deno/functions/postmark",
  "update_password": "/home/deno/functions/update_password",
  "users": "/home/deno/functions/users",
};

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const functionName = pathSegments[0];

  // Health check
  if (url.pathname === "/health" || url.pathname === "/" || !functionName) {
    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { "content-type": "application/json" },
    });
  }

  const functionPath = functionMap[functionName];
  if (!functionPath) {
    return new Response(JSON.stringify({ error: `Function '${functionName}' not found` }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  // Dynamic import and forward
  try {
    const mod = await import(`${functionPath}/index.ts`);
    const forwardUrl = new URL(req.url);
    forwardUrl.pathname = "/" + pathSegments.slice(1).join("/");

    return await mod.default(new Request(forwardUrl.toString(), req));
  } catch (error) {
    console.error(`Error invoking function '${functionName}':`, error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
