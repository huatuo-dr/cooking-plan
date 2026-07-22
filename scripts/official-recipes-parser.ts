export interface ParsedOfficialRecipe {
  title: string
  ingredients: { name: string; amount?: string }[]
  steps: { phase: 'prep' | 'cook'; text: string }[]
}

interface OutlineNode {
  text: string
  children: OutlineNode[]
}

const typoCorrections: Array<[RegExp, string]> = [
  [/耗油/g, '蚝油'],
  [/汁儿/g, '汁'],
  [/姜蒜切沫/g, '姜蒜切末'],
  [/姜蒜沫/g, '姜蒜末'],
  [/蒜沫/g, '蒜末'],
  [/到上料汁/g, '倒上料汁'],
  [/绿泡10分钟/g, '绿豆泡10分钟'],
  [/洋葱半颗，片2片/g, '洋葱半颗，姜片2片'],
  [/洋葱姜片花椒桂皮香叶/g, '洋葱、姜片、花椒、桂皮、香叶'],
  [/洋葱花椒桂皮香叶/g, '洋葱、花椒、桂皮、香叶'],
  [/肉到，筷子轻松扎穿/g, '肉炖到筷子能轻松扎穿'],
  [/翻入剩余香菜/g, '放入剩余香菜'],
  [/控干水分，控干水分/g, '控干水分'],
  [/豆腐皮蛋/g, '皮蛋豆腐'],
  [/撇如鸡蛋液/g, '淋入鸡蛋液'],
  [/鸡皮面冲下/g, '鸡皮面朝下'],
  [/根部冲上/g, '根部朝上'],
  [/关火再闷/g, '关火再焖'],
  [/葱香菜/g, '葱、香菜'],
  [/葱花香菜/g, '葱花、香菜'],
  [/鸡腿2/g, '鸡腿2个'],
  [/鸡蛋2/g, '鸡蛋2个'],
  [/加入，/g, '加入'],
  [/加入1料酒/g, '加入1勺料酒'],
  [/、1番茄酱/g, '、1勺番茄酱'],
  [/、1生抽/g, '、1勺生抽'],
  [/、1老抽/g, '、1勺老抽'],
]

export function cleanRecipeText(text: string): string {
  let cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/，\s*/g, '，')
    .replace(/、\s*/g, '、')
    .replace(/\s*：\s*/g, '：')
    .trim()

  for (const [pattern, replacement] of typoCorrections) {
    cleaned = cleaned.replace(pattern, replacement)
  }

  return cleaned.replace(/[，、\s]+$/g, '')
}

export function parseOfficialRecipesFromHtml(html: string): ParsedOfficialRecipe[] {
  const rootNodes = parseOutlineNodes(html)

  return rootNodes
    .map((node) => {
      const title = cleanRecipeText(node.text)
      const childTexts = flattenChildTexts(node.children)
      const firstPreparation = childTexts[0]?.match(/^准备[:：](.+)$/)
      const ingredients = firstPreparation ? parseIngredients(firstPreparation[1]) : []
      const stepTexts = firstPreparation ? childTexts.slice(1) : childTexts

      return {
        title,
        ingredients,
        steps: stepTexts.map((text) => ({
          phase: isPrepStep(text) ? 'prep' as const : 'cook' as const,
          text,
        })),
      }
    })
    .filter((recipe) => recipe.title && (recipe.ingredients.length > 0 || recipe.steps.length > 0))
}

function flattenChildTexts(nodes: OutlineNode[]): string[] {
  const texts: string[] = []

  for (const node of nodes) {
    const text = cleanRecipeText(node.text)
    if (text) {
      texts.push(text)
    }
    texts.push(...flattenChildTexts(node.children))
  }

  return texts
}

function parseIngredients(text: string): { name: string; amount?: string }[] {
  return text
    .split(/[、，,]/)
    .map((name) => cleanRecipeText(name))
    .filter(Boolean)
    .map((name) => ({ name }))
}

function isPrepStep(text: string): boolean {
  return /切|洗|泡|腌|焯水|备用|去皮|去骨|去核|拍|撕|控干|沥干|搅拌|抓拌|改花刀/.test(text)
}

function parseOutlineNodes(html: string): OutlineNode[] {
  const roots: OutlineNode[] = []
  const stack: OutlineNode[] = []
  const tokenPattern = /<li\b[^>]*class="[^"]*\bnode\b[^"]*"[^>]*>|<\/li>|<div\b[^>]*class="[^"]*\bcontent\b[^"]*"[^>]*>([\s\S]*?)<\/div>/g

  for (const match of html.matchAll(tokenPattern)) {
    const token = match[0]

    if (token.startsWith('<li')) {
      const node: OutlineNode = { text: '', children: [] }
      const parent = stack.at(-1)
      if (parent) {
        parent.children.push(node)
      } else {
        roots.push(node)
      }
      stack.push(node)
      continue
    }

    if (token.startsWith('</li')) {
      stack.pop()
      continue
    }

    const current = stack.at(-1)
    if (current && !current.text) {
      current.text = decodeHtml(stripTags(match[1] ?? ''))
    }
  }

  return roots
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}
