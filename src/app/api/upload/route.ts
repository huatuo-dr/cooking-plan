import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { nanoid } from 'nanoid'
import { getSession } from '@/lib/auth'
import { rateLimit, getClientIP } from '@/lib/rate-limit'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024  // 5MB

export async function POST(request: NextRequest) {
  try {
    // #5 上传需要鉴权
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    // E rate-limit：每个用户每分钟最多 10 次上传
    const limit = rateLimit(`upload:${session.id}`, { windowSec: 60, max: 10 })
    if (!limit.success) {
      const retryAfter = Math.ceil((limit.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: `上传过于频繁，请 ${retryAfter} 秒后重试` },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: '没有上传文件' }, { status: 400 })
    }

    // 文件大小校验
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '图片大小不能超过 5MB' }, { status: 400 })
    }

    // MIME 类型校验（初步）
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: '只支持 JPG、PNG、WebP 格式' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // #5 使用 sharp 检查真实文件头
    let metadata
    try {
      metadata = await sharp(buffer).metadata()
    } catch (e) {
      return NextResponse.json({ error: '无效的图片文件' }, { status: 400 })
    }

    const sharpFormat = metadata.format
    if (!['jpeg', 'png', 'webp'].includes(sharpFormat || '')) {
      return NextResponse.json({ error: '检测到非真实图片文件' }, { status: 400 })
    }

    // E 使用 nanoid 防止文件名碰撞
    const ext = sharpFormat === 'jpeg' ? 'jpg' : sharpFormat
    const filename = `${nanoid(16)}.${ext}`

    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    const filepath = path.join(uploadDir, filename)

    // 通过 sharp 重新生成图片（剥离潜在恶意内容）
    await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .toFile(filepath)

    return NextResponse.json({ url: `/uploads/${filename}` })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: '上传失败' }, { status: 500 })
  }
}
