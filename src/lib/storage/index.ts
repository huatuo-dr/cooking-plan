// 统一存储接口设计
// 支持匿名/登录两种用户体验，运行时根据登录状态自动选择底层实现

export interface RecipeInput {
  title: string
  imageUrl?: string
  ingredients: { name: string; amount?: string }[]
  steps: { phase: 'prep' | 'cook'; text: string }[]
}

export interface Recipe {
  id: number
  title: string
  imageUrl?: string
  ingredients: { name: string; amount?: string }[]
  steps: { phase: 'prep' | 'cook'; text: string }[]
  createdAt: Date
  updatedAt: Date
}

export interface RecipeStorage {
  // 菜谱列表
  listRecipes(): Promise<Recipe[]>

  // 单个菜谱
  getRecipe(id: string | number): Promise<Recipe | null>

  // 创建菜谱
  createRecipe(recipe: RecipeInput): Promise<Recipe>

  // 更新菜谱
  updateRecipe(id: string | number, recipe: RecipeInput): Promise<Recipe>

  // 删除菜谱
  deleteRecipe(id: string | number): Promise<void>

  // 图片上传
  uploadImage(file: File): Promise<string>
}

// 云端存储（登录用户）- 实现待完成
export class CloudStorage implements RecipeStorage {
  async listRecipes(): Promise<Recipe[]> {
    throw new Error('Not implemented')
  }

  async getRecipe(id: string | number): Promise<Recipe | null> {
    throw new Error('Not implemented')
  }

  async createRecipe(recipe: RecipeInput): Promise<Recipe> {
    throw new Error('Not implemented')
  }

  async updateRecipe(id: string | number, recipe: RecipeInput): Promise<Recipe> {
    throw new Error('Not implemented')
  }

  async deleteRecipe(id: string | number): Promise<void> {
    throw new Error('Not implemented')
  }

  async uploadImage(file: File): Promise<string> {
    throw new Error('Not implemented')
  }
}

// 本地存储（匿名用户）- 实现待完成
export class LocalStorage implements RecipeStorage {
  async listRecipes(): Promise<Recipe[]> {
    throw new Error('Not implemented')
  }

  async getRecipe(id: string | number): Promise<Recipe | null> {
    throw new Error('Not implemented')
  }

  async createRecipe(recipe: RecipeInput): Promise<Recipe> {
    throw new Error('Not implemented')
  }

  async updateRecipe(id: string | number, recipe: RecipeInput): Promise<Recipe> {
    throw new Error('Not implemented')
  }

  async deleteRecipe(id: string | number): Promise<void> {
    throw new Error('Not implemented')
  }

  async uploadImage(file: File): Promise<string> {
    throw new Error('Not implemented')
  }
}
