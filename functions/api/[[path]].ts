const API_ORIGIN = "https://interest-bingo-api.eternalwavee-bingo.workers.dev";

export const onRequest: PagesFunction = async ({ request }) => {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, API_ORIGIN);
  const upstreamRequest = new Request(upstreamUrl, request);
  upstreamRequest.headers.delete("origin");
  return fetch(upstreamRequest);
};
