// 简单的内存 rate-limit（适合单实例部署）
// 生产环境多实例部署建议改用 Redis

interface RateLimitEntry {
  count: number
  resetTime: number
}

const limits = new Map<string, RateLimitEntry>()

// 定期清理过期条目（每 5 分钟）
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of limits.entries()) {
    if (entry.resetTime < now) {
      limits.delete(key)
    }
  }
}, 5 * 60 * 1000)

interface RateLimitOptions {
  // 时间窗口（秒）
  windowSec: number
  // 窗口内最大请求数
  max: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

export function rateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const key = identifier
  const now = Date.now()
  const windowMs = options.windowSec * 1000

  const entry = limits.get(key)

  if (!entry || entry.resetTime < now) {
    // 新窗口
    limits.set(key, {
      count: 1,
      resetTime: now + windowMs,
    })
    return {
      success: true,
      remaining: options.max - 1,
      resetAt: now + windowMs,
    }
  }

  entry.count++
  if (entry.count > options.max) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetTime,
    }
  }

  return {
    success: true,
    remaining: options.max - entry.count,
    resetAt: entry.resetTime,
  }
}

// 获取客户端 IP（从请求头中提取）
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }
  return 'unknown'
}
