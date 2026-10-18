import type { Photo } from '../domain/types'

const MAX_DIMENSION = 1600

/** Downscales a picked image to at most 1600px and re-encodes it as JPEG (drops location metadata). */
export async function prepareImage(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas not available')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Encoding failed'))), 'image/jpeg', 0.82),
  )
  return { mimeType: 'image/jpeg', width, height, data: new Uint8Array(await blob.arrayBuffer()) }
}
