import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cooking Plan - 多菜协同菜谱',
  description: '为真实厨房场景设计的多菜协同菜谱应用',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
