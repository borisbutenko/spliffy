import cookie from 'cookie'
import http from 'http'
import { parseQuery, setMultiValueKey } from './url.mjs'
import log from './log.mjs'
import { v4 as uuid } from 'uuid'
import stream from 'stream'
import httpStatusCodes, { defaultStatusMessages } from './httpStatusCodes.mjs'
const { Writable } = stream

const addressArrayBufferToString = addrBuf => String.fromCharCode.apply(null, new Int8Array(addrBuf))
const excludedMessageProps = {
  setTimeout: true,
  _read: true,
  destroy: true,
  _addHeaderLines: true,
  _addHeaderLine: true,
  _dump: true,
  __proto__: true
}

const normalizeHeader = header => header.toLowerCase()

const reqProtoProps = () => Object.keys(http.IncomingMessage.prototype).filter(p => !excludedMessageProps[p])

export const setCookie = (res) => function () {
  return res.setHeader('Set-Cookie', [...(res.getHeader('Set-Cookie') || []), cookie.serialize(...arguments)])
}

export function decorateRequest (uwsReq, pathParameters, res, { decodeQueryParameters, decodePathParameters, parseCookie } = {}) {
  // uwsReq can't be used in async functions because it gets de-allocated when the handler function returns
  const req = {}
  // frameworks like passport like to modify the message prototype
  // Setting the prototype of req is not desirable because the entire api of IncomingMessage is not supported
  for (const p of reqProtoProps()) {
    if (!req[p]) req[p] = http.IncomingMessage.prototype[p]
  }
  const query = uwsReq.getQuery()
  req.path = uwsReq.getUrl()
  req.url = `${req.path}${query ? '?' + query : ''}`
  req.spliffyUrl = {
    path: uwsReq.getUrl(),
    query: parseQuery(uwsReq.getQuery(), decodeQueryParameters)
  }
  req.spliffyUrl.pathParameters = {}
  if (pathParameters && pathParameters.length > 0) {
    for (const i in pathParameters) {
      req.spliffyUrl.pathParameters[pathParameters[i]] = decodePathParameters
        ? decodeURIComponent(uwsReq.getParameter(i))
        : uwsReq.getParameter(i)
    }
  }
  req.params = req.spliffyUrl.pathParameters
  req.headers = {}
  req.method = uwsReq.getMethod().toUpperCase()
  req.remoteAddress = addressArrayBufferToString(res.getRemoteAddressAsText())
  req.proxiedRemoteAddress = addressArrayBufferToString(res.getProxiedRemoteAddressAsText())
  uwsReq.forEach((header, value) => setMultiValueKey(req.headers, normalizeHeader(header), value))
  req.get = header => req.headers[normalizeHeader(header)]
  if (parseCookie && req.headers.cookie) {
    req.cookies = cookie.parse(req.headers.cookie) || {}
  }
  return req
}

export function decorateResponse (res, req, finalizeResponse, errorTransformer, endError, { acceptsDefault }) {
  res.onAborted(() => {
    res.ended = true
    res.writableEnded = true
    res.finalized = true
    log.error(`Request to ${req.url} was aborted`)
  })
  res.acceptsDefault = acceptsDefault
  res.headers = {}
  res.headersSent = false
  res.setHeader = (header, value) => {
    res.headers[normalizeHeader(header)] = value
  }
  res.removeHeader = header => {
    delete res.headers[normalizeHeader(header)]
  }
  res.flushHeaders = () => {
    if (res.headersSent) return
    if (!res.statusCode) res.statusCode = httpStatusCodes.OK
    if (!res.statusMessage) res.statusMessage = defaultStatusMessages[res.statusCode]
    res.headersSent = true
    res.writeStatus(`${res.statusCode} ${res.statusMessage}`)
    if (typeof res.onFlushHeaders === 'function') {
      res.onFlushHeaders(res)
    }
    for (const header of Object.keys(res.headers)) {
      if (Array.isArray(res.headers[header])) {
        for (const multiple of res.headers[header]) {
          res.writeHeader(header, multiple.toString())
        }
      } else {
        res.writeHeader(header, res.headers[header].toString())
      }
    }
  }
  res.writeHead = (status, headers) => {
    res.statusCode = status
    res.assignHeaders(headers)
  }
  res.assignHeaders = headers => {
    for (const header of Object.keys(headers)) {
      res.headers[normalizeHeader(header)] = headers[header]
    }
  }
  res.getHeader = header => {
    return res.headers[normalizeHeader(header)]
  }
  res.status = (code) => {
    res.statusCode = code
    return this
  }

  function toArrayBuffer (buffer) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  }

  let outStream
  res.getWritable = () => {
    if (!outStream) {
      res.streaming = true
      outStream = new Writable({
        write: (chunk, encoding, cb) => {
          try {
            res.flushHeaders()
            const result = res.write(chunk)
            if (typeof cb === 'function') {
              cb()
            }
            return result
          } catch (e) {
            if (typeof cb === 'function') {
              cb(e)
            } else {
              throw e
            }
          }
        }
      })
        .on('finish', res.end)
        .on('end', res.end)
        .on('error', e => {
          try {
            outStream.destroy()
          } finally {
            endError(res, e, uuid(), errorTransformer)
          }
        })
    }
    return outStream
  }
  res.writeArrayBuffer = res.write
  res.write = chunk => {
    res.streaming = true
    res.flushHeaders()
    if (chunk instanceof Buffer) {
      return res.writeArrayBuffer(toArrayBuffer(chunk))
    } else if (typeof chunk === 'string') {
      return res.writeArrayBuffer(toArrayBuffer(Buffer.from(chunk, 'utf8')))
    } else {
      return res.writeArrayBuffer(toArrayBuffer(Buffer.from(JSON.stringify(chunk), 'utf8')))
    }
  }

  const uwsEnd = res.end
  res.ended = false
  res.end = body => {
    if (res.ended) {
      return
    }
    // provide writableEnded like node does, with slightly different behavior
    if (!res.writableEnded) {
      res.flushHeaders()
      uwsEnd.call(res, body)
      res.writableEnded = true
      res.ended = true
    }
    if (typeof res.onEnd === 'function') {
      res.onEnd()
    }
  }

  res.redirect = function (code, location) {
    if (arguments.length === 1) {
      location = code
      code = httpStatusCodes.MOVED_PERMANENTLY
    }
    return finalizeResponse(req, res, {
      statusCode: code,
      headers: {
        location: location
      }
    })
  }
  res.send = (body) => {
    finalizeResponse(req, res, body)
  }
  res.json = res.send
  res.setCookie = setCookie(res)
  res.cookie = res.setCookie
  return res
}
