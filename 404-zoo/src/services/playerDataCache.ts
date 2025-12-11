/**
 * Player Data Cache Service
 * Preload player's cards and deck data to localStorage after wallet connection
 */

import { PublicKey } from '@solana/web3.js'
import {
  getPlayerCardsWithTemplates,
  getPlayerDecks,
  type CardTemplate,
  type CardInstance,
  type PlayerDeck,
} from './contract'

// Cache key
const CACHE_KEY_PREFIX = '404zoo_player_'
const CACHE_VERSION = 'v1'

// Player card data
export interface PlayerCardData {
  instance: CardInstance
  template: CardTemplate | null
}

// Cache data structure
interface CachedPlayerData {
  version: string
  wallet: string
  timestamp: number
  cards: PlayerCardData[]
  decks: PlayerDeck[]
}

// Memory cache
let memoryCache: CachedPlayerData | null = null
let currentWallet: string | null = null
let isLoading = false
let loadPromise: Promise<void> | null = null

// Cache TTL (5 minutes)
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


// Serialize PublicKey (convert to base58 string)
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

// Deserialize (convert string back to PublicKey)
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
 * Preload player data (called after wallet connection)
 */
export async function preloadPlayerData(wallet: PublicKey): Promise<void> {
  const walletStr = wallet.toBase58()
  
  // If same wallet and loading, wait for completion
  if (currentWallet === walletStr && isLoading && loadPromise) {
    return loadPromise
  }
  
  // If valid cache exists, return directly
  if (currentWallet === walletStr && memoryCache) {
    return
  }
  
  currentWallet = walletStr
  isLoading = true
  
  loadPromise = (async () => {
    try {
      // Try reading from localStorage first
      const cached = readFromStorage(walletStr)
      if (cached) {
        console.log('Player data loaded from localStorage cache')
        memoryCache = cached
        return
      }
      
      // Load from chain
      console.log('Loading player data from chain...')
      const [cards, decks] = await Promise.all([
        getPlayerCardsWithTemplates(wallet),
        getPlayerDecks(wallet),
      ])
      
      // Serialize and cache
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
      
      console.log(`Player data cached: ${cards.length} cards, ${decks.length} decks`)
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
 * Get cached player cards
 */
export function getCachedPlayerCards(): PlayerCardData[] {
  if (!memoryCache) return []
  const { cards } = deserializeData(memoryCache)
  return cards
}

/**
 * Get cached player decks
 */
export function getCachedPlayerDecks(): PlayerDeck[] {
  if (!memoryCache) return []
  const { decks } = deserializeData(memoryCache)
  return decks
}

/**
 * Check if cache exists
 */
export function hasPlayerDataCache(): boolean {
  return memoryCache !== null
}

/**
 * Refresh cache (force reload)
 */
export async function refreshPlayerData(wallet: PublicKey): Promise<void> {
  const walletStr = wallet.toBase58()
  
  // Clear old cache
  memoryCache = null
  try {
    localStorage.removeItem(getCacheKey(walletStr))
  } catch {}
  
  // Reload
  return preloadPlayerData(wallet)
}

/**
 * Clear cache
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
