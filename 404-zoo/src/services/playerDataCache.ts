/**
 * 玩家数据缓存服务
 * 在钱包连接后预加载玩家的卡片和卡组数据到 localStorage
 */

import { PublicKey } from '@solana/web3.js'
import {
  getPlayerCardsWithTemplates,
  getPlayerDecks,
  type CardTemplate,
  type CardInstance,
  type PlayerDeck,
} from './contract'

// 缓存 key
const CACHE_KEY_PREFIX = '404zoo_player_'
const CACHE_VERSION = 'v1'

// 玩家卡片数据
export interface PlayerCardData {
  instance: CardInstance
  template: CardTemplate | null
}

// 缓存数据结构
interface CachedPlayerData {
  version: string
  wallet: string
  timestamp: number
  cards: PlayerCardData[]
  decks: PlayerDeck[]
}

// 内存缓存
let memoryCache: CachedPlayerData | null = null
let currentWallet: string | null = null
let isLoading = false
let loadPromise: Promise<void> | null = null

// 缓存有效期 (5分钟)
const CACHE_TTL = 5 * 60 * 1000

// 获取缓存 key
function getCacheKey(wallet: string): string {
  return `${CACHE_KEY_PREFIX}${wallet}_${CACHE_VERSION}`
}

// 从 localStorage 读取缓存
function readFromStorage(wallet: string): CachedPlayerData | null {
  try {
    const key = getCacheKey(wallet)
    const data = localStorage.getItem(key)
    if (!data) return null
    
    const parsed = JSON.parse(data) as CachedPlayerData
    
    // 检查版本和有效期
    if (parsed.version !== CACHE_VERSION) return null
    if (Date.now() - parsed.timestamp > CACHE_TTL) return null
    
    return parsed
  } catch {
    return null
  }
}

// 写入 localStorage
function writeToStorage(data: CachedPlayerData): void {
  try {
    const key = getCacheKey(data.wallet)
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    console.warn('Failed to write player data to localStorage:', e)
  }
}


// 序列化 PublicKey (转为 base58 字符串)
function serializeData(cards: PlayerCardData[], decks: PlayerDeck[]): { cards: unknown[], decks: unknown[] } {
  return {
    cards: cards.map(c => ({
      instance: {
        ...c.instance,
        mint: c.instance.mint.toBase58(),
        owner: c.instance.owner.toBase58(),
      },
      template: c.template,
    })),
    decks: decks.map(d => ({
      ...d,
      cardMints: d.cardMints.map(m => m.toBase58()),
    })),
  }
}

// 反序列化 (字符串转回 PublicKey)
function deserializeData(data: CachedPlayerData): { cards: PlayerCardData[], decks: PlayerDeck[] } {
  return {
    cards: (data.cards as unknown[]).map((c: any) => ({
      instance: {
        ...c.instance,
        mint: new PublicKey(c.instance.mint),
        owner: new PublicKey(c.instance.owner),
      },
      template: c.template,
    })),
    decks: (data.decks as unknown[]).map((d: any) => ({
      ...d,
      cardMints: d.cardMints.map((m: string) => new PublicKey(m)),
    })),
  }
}

/**
 * 预加载玩家数据 (钱包连接后调用)
 */
export async function preloadPlayerData(wallet: PublicKey): Promise<void> {
  const walletStr = wallet.toBase58()
  
  // 如果是同一个钱包且正在加载，等待完成
  if (currentWallet === walletStr && isLoading && loadPromise) {
    return loadPromise
  }
  
  // 如果已有有效缓存，直接返回
  if (currentWallet === walletStr && memoryCache) {
    return
  }
  
  currentWallet = walletStr
  isLoading = true
  
  loadPromise = (async () => {
    try {
      // 先尝试从 localStorage 读取
      const cached = readFromStorage(walletStr)
      if (cached) {
        console.log('📦 Player data loaded from localStorage cache')
        memoryCache = cached
        return
      }
      
      // 从链上加载
      console.log('🔄 Loading player data from chain...')
      const [cards, decks] = await Promise.all([
        getPlayerCardsWithTemplates(wallet),
        getPlayerDecks(wallet),
      ])
      
      // 序列化并缓存
      const serialized = serializeData(cards, decks)
      const cacheData: CachedPlayerData = {
        version: CACHE_VERSION,
        wallet: walletStr,
        timestamp: Date.now(),
        cards: serialized.cards as any,
        decks: serialized.decks as any,
      }
      
      memoryCache = cacheData
      writeToStorage(cacheData)
      
      console.log(`✅ Player data cached: ${cards.length} cards, ${decks.length} decks`)
    } catch (error) {
      console.error('Failed to preload player data:', error)
      throw error
    } finally {
      isLoading = false
    }
  })()
  
  return loadPromise
}

/**
 * 获取缓存的玩家卡片
 */
export function getCachedPlayerCards(): PlayerCardData[] {
  if (!memoryCache) return []
  const { cards } = deserializeData(memoryCache)
  return cards
}

/**
 * 获取缓存的玩家卡组
 */
export function getCachedPlayerDecks(): PlayerDeck[] {
  if (!memoryCache) return []
  const { decks } = deserializeData(memoryCache)
  return decks
}

/**
 * 检查是否有缓存
 */
export function hasPlayerDataCache(): boolean {
  return memoryCache !== null
}

/**
 * 刷新缓存 (强制重新加载)
 */
export async function refreshPlayerData(wallet: PublicKey): Promise<void> {
  const walletStr = wallet.toBase58()
  
  // 清除旧缓存
  memoryCache = null
  try {
    localStorage.removeItem(getCacheKey(walletStr))
  } catch {}
  
  // 重新加载
  return preloadPlayerData(wallet)
}

/**
 * 清除缓存
 */
export function clearPlayerDataCache(): void {
  if (currentWallet) {
    try {
      localStorage.removeItem(getCacheKey(currentWallet))
    } catch {}
  }
  memoryCache = null
  currentWallet = null
  loadPromise = null
}
