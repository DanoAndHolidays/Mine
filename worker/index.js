const SPA_ENTRY = '/index.html'

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)
    if (response.status !== 404) return response

    const url = new URL(request.url)
    if (request.method === 'GET' && !url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(new Request(new URL(SPA_ENTRY, request.url), request))
    }

    return response
  },
}
