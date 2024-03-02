import { Redis } from '@upstash/redis'
import { PostHogEvent } from './posthog'

const { UPSTASH_URL, UPSTASH_TOKEN } = process.env
let redis: Redis | null = null
if (UPSTASH_URL && UPSTASH_TOKEN) {
    redis = new Redis({
        url: UPSTASH_URL,
        token: UPSTASH_TOKEN
    })
}

type CacheData = {
    'posthog_events_': PostHogEvent[]
}

export async function getFromCache<T extends keyof CacheData>(prefix: T, key: string): Promise<CacheData[T] | null> {
    if (!redis) {
        return null
    }
    const value = await redis.get(`${prefix}${key}`)
    if (!value) {
        return null
    }
    return value as CacheData[T]
}

export async function setToCache<T extends keyof CacheData>(prefix: T, key: string, value: CacheData[T]) {
    if (!redis) {
        return
    }
    await redis.set(`${prefix}${key}`, value)
}