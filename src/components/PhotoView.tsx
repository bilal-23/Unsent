import type { Photo } from '../domain/types'
import { useObjectUrl } from '../hooks/useObjectUrl'

export function PhotoView({ photo, alt, className = '', cacheKey }: { photo: Photo; alt: string; className?: string; cacheKey?: string }) {
  const url = useObjectUrl(photo.data, photo.mimeType, cacheKey)
  if (!url) return null
  return <img src={url} alt={alt} width={photo.width} height={photo.height} className={`h-auto max-w-full rounded-xl ${className}`} loading="lazy" />
}
