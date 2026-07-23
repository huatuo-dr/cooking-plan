import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  db: {
    transaction: vi.fn(),
  },
  getSession: vi.fn(),
  revalidatePath: vi.fn(),
  syncRecipeTagsInTx: vi.fn(),
  cleanupUnusedRecipeImage: vi.fn(),
}))

vi.mock('@/db', () => ({ db: mocks.db }))
vi.mock('@/db/schema', () => {
  const table = new Proxy({}, {
    get: (_target, prop) => prop,
  })
  return {
    recipes: table,
    ingredients: table,
    steps: table,
    users: table,
    recipeTags: table,
    recipeTagRelations: table,
  }
})
vi.mock('@/lib/auth', () => ({ getSession: mocks.getSession }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/actions/recipe-tags', () => ({ syncRecipeTagsInTx: mocks.syncRecipeTagsInTx }))
vi.mock('@/lib/actions/recipe-images', () => ({
  cleanupUnusedRecipeImage: mocks.cleanupUnusedRecipeImage,
}))
vi.mock('@/lib/actions/recipe-update', () => ({
  getNextRecipeImageUrl: (
    input: { imageUrl?: string | null },
    oldImageUrl: string | null
  ) => input.imageUrl === undefined ? oldImageUrl : input.imageUrl,
  shouldCleanupOldRecipeImage: (
    oldImageUrl: string | null | undefined,
    nextImageUrl: string | null | undefined
  ) => !!oldImageUrl && oldImageUrl !== nextImageUrl,
}))

function queryChain(result: unknown[]) {
  const chain: any = {}
  chain.from = vi.fn(() => chain)
  chain.leftJoin = vi.fn(() => chain)
  chain.where = vi.fn(() => chain)
  chain.limit = vi.fn(async () => result)
  return chain
}

function writeChain() {
  const chain: any = {}
  chain.set = vi.fn(() => chain)
  chain.values = vi.fn(() => Promise.resolve())
  chain.where = vi.fn(() => Promise.resolve())
  return chain
}

function createTx(recipeInfo: unknown[]) {
  const updateChain = writeChain()
  const deleteChain = writeChain()
  const insertChain = writeChain()
  const tx = {
    select: vi.fn(() => queryChain(recipeInfo)),
    update: vi.fn(() => updateChain),
    delete: vi.fn(() => deleteChain),
    insert: vi.fn(() => insertChain),
  }
  return { tx, updateChain }
}

const validUpdate = {
  title: '番茄炒蛋',
  ingredients: [{ name: '番茄', amount: '2个' }],
  steps: [{ phase: 'cook' as const, text: '炒熟' }],
}

describe('updateRecipe image behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ id: 7, email: 'u@example.com', role: 'user' })
    mocks.cleanupUnusedRecipeImage.mockResolvedValue('deleted')
    mocks.db.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const { tx } = createTx([
        { userId: 7, authorRole: 'user', imageUrl: '/uploads/abcdefghijklmnop.jpg' },
      ])
      return await callback(tx)
    })
  })

  it('does not reject when best-effort cleanup fails after the recipe update commits', async () => {
    const { updateRecipe } = await import('./recipes')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.cleanupUnusedRecipeImage.mockRejectedValueOnce(new Error('cleanup failed'))

    try {
      await expect(updateRecipe(12, { ...validUpdate, imageUrl: null })).resolves.toBeUndefined()

      expect(mocks.cleanupUnusedRecipeImage).toHaveBeenCalledWith(
        '/uploads/abcdefghijklmnop.jpg',
        expect.objectContaining({ hasReferences: expect.any(Function) })
      )
      expect(consoleError).toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })

  it('keeps the old image and skips cleanup when imageUrl is omitted', async () => {
    const { updateRecipe } = await import('./recipes')
    let updateSetPayload: unknown

    mocks.db.transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
      const { tx, updateChain } = createTx([
        { userId: 7, authorRole: 'user', imageUrl: '/uploads/abcdefghijklmnop.jpg' },
      ])
      updateChain.set.mockImplementationOnce((payload: unknown) => {
        updateSetPayload = payload
        return updateChain
      })
      return await callback(tx)
    })

    await updateRecipe(12, validUpdate)

    expect(updateSetPayload).not.toHaveProperty('imageUrl')
    expect(mocks.cleanupUnusedRecipeImage).not.toHaveBeenCalled()
  })

  it('clears the image and cleans up only the old image when imageUrl is null', async () => {
    const { updateRecipe } = await import('./recipes')
    let updateSetPayload: unknown

    mocks.db.transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
      const { tx, updateChain } = createTx([
        { userId: 7, authorRole: 'user', imageUrl: '/uploads/abcdefghijklmnop.jpg' },
      ])
      updateChain.set.mockImplementationOnce((payload: unknown) => {
        updateSetPayload = payload
        return updateChain
      })
      return await callback(tx)
    })

    await updateRecipe(12, { ...validUpdate, imageUrl: null })

    expect(updateSetPayload).toMatchObject({ imageUrl: null })
    expect(mocks.cleanupUnusedRecipeImage).toHaveBeenCalledWith(
      '/uploads/abcdefghijklmnop.jpg',
      expect.objectContaining({ hasReferences: expect.any(Function) })
    )
  })

  it('replaces the image and cleans up only the old image', async () => {
    const { updateRecipe } = await import('./recipes')
    let updateSetPayload: unknown

    mocks.db.transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
      const { tx, updateChain } = createTx([
        { userId: 7, authorRole: 'user', imageUrl: '/uploads/abcdefghijklmnop.jpg' },
      ])
      updateChain.set.mockImplementationOnce((payload: unknown) => {
        updateSetPayload = payload
        return updateChain
      })
      return await callback(tx)
    })

    await updateRecipe(12, { ...validUpdate, imageUrl: '/uploads/ponmlkjihgfedcba.webp' })

    expect(updateSetPayload).toMatchObject({ imageUrl: '/uploads/ponmlkjihgfedcba.webp' })
    expect(mocks.cleanupUnusedRecipeImage).toHaveBeenCalledWith(
      '/uploads/abcdefghijklmnop.jpg',
      expect.objectContaining({ hasReferences: expect.any(Function) })
    )
  })

  it('does not cleanup when the user has no edit permission', async () => {
    const { updateRecipe } = await import('./recipes')
    mocks.db.transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
      const { tx } = createTx([
        { userId: 99, authorRole: 'user', imageUrl: '/uploads/abcdefghijklmnop.jpg' },
      ])
      return await callback(tx)
    })

    await expect(updateRecipe(12, { ...validUpdate, imageUrl: null })).rejects.toThrow('没有编辑权限')

    expect(mocks.cleanupUnusedRecipeImage).not.toHaveBeenCalled()
  })
})
