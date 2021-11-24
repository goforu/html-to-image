import { Options } from './options'
import { parseDataUrlContent } from './util'
import { convertUrlToBase64, convertUrlToResponse } from './index'

export interface Metadata {
  blob: string
  contentType: string
}

const cache: {
  [url: string]: Promise<Metadata>
} = {}

function getCacheKey(url: string) {
  let key = url.replace(/\?.*/, '')

  // font resourse
  if (/ttf|otf|eot|woff2?/i.test(key)) {
    key = key.replace(/.*\//, '')
  }

  return key
}

export function getBlobFromURL(
  url: string,
  options: Options,
): Promise<Metadata> {
  const cacheKey = getCacheKey(url)

  if (cache[cacheKey] != null) {
    return cache[cacheKey]
  }

  // cache bypass so we dont have CORS issues with cached images
  // ref: https://developer.mozilla.org/en/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest#Bypassing_the_cache
  if (options.cacheBust) {
    // eslint-disable-next-line no-param-reassign
    url += (/\?/.test(url) ? '&' : '?') + new Date().getTime()
  }

  const failed = (reason: any): Metadata => {
    let placeholder = ''
    if (options.imagePlaceholder) {
      const parts = options.imagePlaceholder.split(/,/)
      if (parts && parts[1]) {
        placeholder = parts[1]
      }
    }

    let msg = `Failed to fetch resource: ${url}`
    if (reason) {
      msg = typeof reason === 'string' ? reason : reason.message
    }

    if (msg) {
      console.error(msg)
    }

    return {
      blob: placeholder,
      contentType: '',
    }
  }

  // eslint-disable-next-line no-shadow
  const fetchUrl = async (url: string): Promise<Response> => {
    if (url.indexOf(window.location.origin) !== 0) {
      if (convertUrlToBase64) {
        return convertUrlToBase64(url).then((dataUrl) => fetch(dataUrl))
      }
      if (convertUrlToResponse) {
        return convertUrlToResponse(url)
      }
    }
    return fetch(url)
  }

  const deferred = fetchUrl(url)
    // eslint-disable-next-line no-shadow
    .then((res) =>
      // eslint-disable-next-line promise/no-nesting
      res.blob().then((blob) => ({
        blob,
        contentType: res.headers.get('Content-Type') || '',
      })),
    )
    .then(
      ({ blob, contentType }) =>
        new Promise<Metadata>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () =>
            resolve({
              contentType,
              blob: reader.result as string,
            })
          reader.onerror = reject
          reader.readAsDataURL(blob)
        }),
    )
    .then(({ blob, contentType }) => ({
      contentType,
      blob: parseDataUrlContent(blob),
    }))
    // on failed
    .catch(failed)

  // cache result
  cache[cacheKey] = deferred

  return deferred
}
