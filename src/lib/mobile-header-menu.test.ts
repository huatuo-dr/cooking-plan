import { describe, expect, test } from 'vitest'

import { getMobileHeaderMenuItems } from './mobile-header-menu'

describe('mobile header menu items', () => {
  test('shows guest actions in priority order with correct semantics', () => {
    expect(getMobileHeaderMenuItems({ isLoggedIn: false, isAdmin: false })).toEqual([
      { id: 'cooking', label: 'Cooking', kind: 'link', href: '/cooking' },
      { id: 'import-json', label: '导入 JSON', kind: 'action' },
      { id: 'bulk-export', label: '批量导出', kind: 'action' },
      { id: 'login', label: '登录', kind: 'link', href: '/login' },
      { id: 'register', label: '注册', kind: 'link', href: '/register' },
    ])
  })

  test('shows profile for signed-in users without adding an admin shortcut', () => {
    expect(getMobileHeaderMenuItems({ isLoggedIn: true, isAdmin: true })).toEqual([
      { id: 'cooking', label: 'Cooking', kind: 'link', href: '/cooking' },
      { id: 'import-json', label: '导入 JSON', kind: 'action' },
      { id: 'bulk-export', label: '批量导出', kind: 'action' },
      { id: 'profile', label: '个人中心', kind: 'link', href: '/profile' },
    ])
  })
})
