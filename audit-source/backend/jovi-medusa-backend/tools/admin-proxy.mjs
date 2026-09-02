import http from "node:http"

const targetHost = "backend"
const targetPort = 9000
const listenPort = 19001

const server = http.createServer((request, response) => {
  const upstream = http.request({
    host: targetHost,
    port: targetPort,
    path: request.url,
    method: request.method,
    headers: { ...request.headers, host: `${targetHost}:${targetPort}` },
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers)
    upstreamResponse.pipe(response)
  })

  upstream.on("error", (error) => {
    if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain" })
    response.end(`admin proxy unavailable: ${error.code ?? "upstream_error"}`)
  })

  request.pipe(upstream)
})

server.listen(listenPort, "0.0.0.0")

const shutdown = () => server.close(() => process.exit(0))
process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
