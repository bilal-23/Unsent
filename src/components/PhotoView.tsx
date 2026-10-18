import type { Photo } from '../domain/types'
import { useObjectUrl } from '../hooks/useObjectUrl'

export function PhotoView({ photo, alt, className = '' }: { photo: Photo; alt: string; className?: string }) {
  const url = useObjectUrl(photo.data, photo.mimeType)
  if (!url) return null
  return <img src={url} alt={alt} width={photo.width} height={photo.height} className={`h-auto max-w-full rounded-xl ${className}`} loading="lazy" />
}
