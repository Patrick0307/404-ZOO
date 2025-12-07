import type { CardTemplate } from './contract'
import { getAllCardTemplates } from './contract'

// 全局卡片缓存
let cardTemplatesCache: CardTemplate[] | null = null
let isLoading = false
let loadPromise: Promise<CardTemplate[]> | null = null

// 将 IPFS URI 转换为可访问的 HTTP URL
export function getImageUrl(imageUri: string): string {
  if (!imageUri) return ''
  if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
    return imageUri
  }
  if (imageUri.startsWith('ipfs://')) {
    return imageUri.replace('ipfs://', 'https://ipfs.io/ipfs/')
  }
  return `https://ipfs.io/ipfs/${imageUri}`
}

// 预加载单张图片
function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    if (!url) {
      resolve()
      return
    }
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve() // 失败也继续
    img.src = url
  })
}

// 预加载所有卡片图片
async function preloadAllImages(cards: CardTemplate[]): Promise<void> {
  const imageUrls = cards
    .map(card => getImageUrl(card.imageUri))
    .filter(url => url !== '')

  console.log(`Preloading ${imageUrls.length} card images...`)

  // 并行加载，但限制并发数
  const CONCURRENT_LIMIT = 5
  for (let i = 0; i < imageUrls.length; i += CONCURRENT_LIMIT) {
    const batch = imageUrls.slice(i, i + CONCURRENT_LIMIT)
    await Promise.all(batch.map(url => preloadImage(url)))
  }

  console.log('All card images preloaded!')
}

// 加载并缓存所有卡片模板
export async function loadAndCacheCards(): Promise<CardTemplate[]> {
  // 如果已经有缓存，直接返回
  if (cardTemplatesCache) {
    return cardTemplatesCache
  }

  // 如果正在加载，等待加载完成
  if (isLoading && loadPromise) {
    return loadPromise
  }

  // 开始加载
  isLoading = true
  loadPromise = (async () => {
    try {
      console.log('Loading card templates from chain...')
      const templates = await getAllCardTemplates(100)

      // 按稀有度排序: Legendary > Epic > Rare > Common
      templates.sort((a, b) => b.rarity - a.rarity)

      // 缓存数据
      cardTemplatesCache = templates
      console.log(`Cached ${templates.length} card templates`)

      // 后台预加载图片（不阻塞返回）
      preloadAllImages(templates).catch(console.error)

      return templates
    } catch (error) {
      console.error('Failed to load card templates:', error)
      throw error
    } finally {
      isLoading = false
    }
  })()

  return loadPromise
}

// 获取缓存的卡片（如果没有缓存则加载）
export async function getCachedCards(): Promise<CardTemplate[]> {
  if (cardTemplatesCache) {
    return cardTemplatesCache
  }
  return loadAndCacheCards()
}

// 同步获取缓存（可能为 null）
export function getCachedCardsSync(): CardTemplate[] | null {
  return cardTemplatesCache
}

// 检查是否已加载
export function isCardsLoaded(): boolean {
  return cardTemplatesCache !== null
}

// 清除缓存（如果需要刷新）
export function clearCardCache(): void {
  cardTemplatesCache = null
  loadPromise = null
}

// 根据 cardTypeId 获取单个卡片模板
export function getCardTemplateById(cardTypeId: number): CardTemplate | undefined {
  return cardTemplatesCache?.find(card => card.cardTypeId === cardTypeId)
}
