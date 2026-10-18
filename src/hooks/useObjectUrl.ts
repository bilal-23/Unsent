import { useEffect, useState } from 'react'

/** A blob: URL for stored bytes (photos, recordings), revoked when no longer needed. */
export function useObjectUrl(data: Uint8Array, mimeType: string): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const objectUrl = URL.createObjectURL(new Blob([data as BlobPart], { type: mimeType }))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is an external resource that must be created and revoked together
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [data, mimeType])
  return url
}
