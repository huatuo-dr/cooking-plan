export type MobileHeaderMenuItemId =
  | 'cooking'
  | 'import-json'
  | 'bulk-export'
  | 'login'
  | 'register'
  | 'profile'

export interface MobileHeaderMenuItem {
  id: MobileHeaderMenuItemId
  label: string
  kind: 'link' | 'action'
  href?: string
}

interface MobileHeaderMenuOptions {
  isLoggedIn: boolean
  isAdmin: boolean
}

export function getMobileHeaderMenuItems(options: MobileHeaderMenuOptions): MobileHeaderMenuItem[] {
  const commonItems: MobileHeaderMenuItem[] = [
    { id: 'cooking', label: 'Cooking', kind: 'link', href: '/cooking' },
    { id: 'import-json', label: '导入 JSON', kind: 'action' },
    { id: 'bulk-export', label: '批量导出', kind: 'action' },
  ]

  if (options.isLoggedIn) {
    return [
      ...commonItems,
      { id: 'profile', label: '个人中心', kind: 'link', href: '/profile' },
    ]
  }

  return [
    ...commonItems,
    { id: 'login', label: '登录', kind: 'link', href: '/login' },
    { id: 'register', label: '注册', kind: 'link', href: '/register' },
  ]
}
