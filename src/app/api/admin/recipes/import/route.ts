import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'
import { importRecipesForUser, validateImportRequestBody } from '@/lib/actions/recipe-import'
import { MAX_RECIPE_IMPORT_FILE_BYTES } from '@/lib/recipe-package'

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > MAX_RECIPE_IMPORT_FILE_BYTES) {
      return NextResponse.json({ error: 'JSON 文件不能超过 2MB' }, { status: 413 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }
    if (session.role !== 'admin') {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 })
    }

    const body = await request.json()
    const recipePackage = validateImportRequestBody(body)
    const result = await importRecipesForUser(session.id, recipePackage)

    revalidatePath('/')
    return NextResponse.json(result)
  } catch (error: any) {
    const message = error instanceof Error ? error.message : '导入失败'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
