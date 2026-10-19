import { useEffect, useRef, useState } from 'react'

/**
 * A blob: URL for stored bytes (photos, recordings), revoked when no longer needed.
 *
 * Pass a stable `cacheKey` (e.g. `${id}:${updatedAt}`): live queries hand back a new
 * Uint8Array on every refresh, and recreating the URL each time would reset an <audio>
 * element mid-playback.
 */
export function useObjectUrl(data: Uint8Array, mimeType: string, cacheKey?: string): string | null {
  const [url, setUrl] = useState<string | null>(null)
  const dataRef = useRef(data)
  useEffect(() => {
    dataRef.current = data
  })
  const identity = cacheKey ?? data
  useEffect(() => {
    const objectUrl = URL.createObjectURL(new Blob([dataRef.current as BlobPart], { type: mimeType }))
    // The URL is an external resource that must be created and revoked together.
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [identity, mimeType])
  return url
}
