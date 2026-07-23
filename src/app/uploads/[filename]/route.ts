import { NextRequest, NextResponse } from 'next/server'

import { readUploadedImage } from '@/lib/uploaded-images'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const result = await readUploadedImage(filename)

  if (result.status === 'invalid') {
    return NextResponse.json({ error: 'Invalid image path' }, { status: 400 })
  }

  if (result.status === 'missing') {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(result.body), {
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
