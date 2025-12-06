import {
  Connection,
  PublicKey,
  clusterApiUrl,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js'
import { Buffer } from 'buffer'

// Phantom 类型 (本地使用)
interface PhantomWallet {
  isPhantom?: boolean
  publicKey: PublicKey
  signTransaction: (tx: Transaction) => Promise<Transaction>
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>
}

// Contract Program ID
export const PROGRAM_ID = new PublicKey('At8EveJA8pq81nar1jjxBW2xshNex7kbefzVzJ4BaU9o')

// Devnet connection
export const connection = new Connection(clusterApiUrl('devnet'), 'confirmed')

// ============================================================================
// Enums (与合约保持一致)
// ============================================================================

export const TraitType = {
  Warrior: 0,
  Archer: 1,
  Assassin: 2,
} as const

export type TraitType = (typeof TraitType)[keyof typeof TraitType]

export const Rarity = {
  Common: 0,
  Rare: 1,
  Epic: 2,
  Legendary: 3,
} as const

export type Rarity = (typeof Rarity)[keyof typeof Rarity]

export const TraitTypeNames: Record<TraitType, string> = {
  [TraitType.Warrior]: 'Warrior',
  [TraitType.Archer]: 'Archer',
  [TraitType.Assassin]: 'Assassin',
}

export const RarityNames: Record<Rarity, string> = {
  [Rarity.Common]: 'Common',
  [Rarity.Rare]: 'Rare',
  [Rarity.Epic]: 'Epic',
  [Rarity.Legendary]: 'Legendary',
}

export const RarityColors: Record<Rarity, string> = {
  [Rarity.Common]: '#9e9e9e',
  [Rarity.Rare]: '#2196f3',
  [Rarity.Epic]: '#9c27b0',
  [Rarity.Legendary]: '#ff9800',
}

// 反向映射：数字 -> 名称
export const RarityToName: Record<Rarity, string> = {
  [Rarity.Common]: 'common',
  [Rarity.Rare]: 'rare',
  [Rarity.Epic]: 'epic',
  [Rarity.Legendary]: 'legendary',
}

// ============================================================================
// CardTemplate 类型和函数
// ============================================================================

export interface CardTemplate {
  cardTypeId: number
  name: string
  traitType: TraitType
  rarity: Rarity
  minAttack: number
  maxAttack: number
  minHealth: number
  maxHealth: number
  description: string
  imageUri: string
}

// 获取 CardTemplate PDA
export function getCardTemplatePDA(cardTypeId: number): [PublicKey, number] {
  const cardTypeIdBuffer = Buffer.alloc(4)
  cardTypeIdBuffer.writeUInt32LE(cardTypeId, 0)
  return PublicKey.findProgramAddressSync(
    [Buffer.from('card_template'), cardTypeIdBuffer],
    PROGRAM_ID
  )
}

// 解析 CardTemplate 账户数据
function parseCardTemplate(data: Buffer): CardTemplate {
  // Anchor 账户结构:
  // 8 bytes: discriminator
  // 4 bytes: card_type_id (u32)
  // 4 bytes: name length + name bytes (max 32)
  // 1 byte: trait_type
  // 1 byte: rarity
  // 2 bytes: min_attack (u16)
  // 2 bytes: max_attack (u16)
  // 2 bytes: min_health (u16)
  // 2 bytes: max_health (u16)
  // 4 bytes: description length + description bytes (max 200)
  // 4 bytes: image_uri length + image_uri bytes (max 200)
  // 1 byte: bump

  let offset = 8 // skip discriminator

  // Read card_type_id (4 bytes)
  const cardTypeId = data.readUInt32LE(offset)
  offset += 4

  // Read name (4 bytes length + string)
  const nameLen = data.readUInt32LE(offset)
  offset += 4
  const name = data.slice(offset, offset + nameLen).toString('utf-8')
  offset += nameLen

  // Read trait_type (1 byte)
  const traitType = data[offset] as TraitType
  offset += 1

  // Read rarity (1 byte)
  const rarity = data[offset] as Rarity
  offset += 1

  // Read min_attack (2 bytes)
  const minAttack = data.readUInt16LE(offset)
  offset += 2

  // Read max_attack (2 bytes)
  const maxAttack = data.readUInt16LE(offset)
  offset += 2

  // Read min_health (2 bytes)
  const minHealth = data.readUInt16LE(offset)
  offset += 2

  // Read max_health (2 bytes)
  const maxHealth = data.readUInt16LE(offset)
  offset += 2

  // Read description (4 bytes length + string)
  const descLen = data.readUInt32LE(offset)
  offset += 4
  const description = data.slice(offset, offset + descLen).toString('utf-8')
  offset += descLen

  // Read image_uri (4 bytes length + string)
  const imageUriLen = data.readUInt32LE(offset)
  offset += 4
  const imageUri = data.slice(offset, offset + imageUriLen).toString('utf-8')

  return {
    cardTypeId,
    name,
    traitType,
    rarity,
    minAttack,
    maxAttack,
    minHealth,
    maxHealth,
    description,
    imageUri,
  }
}

// 获取单个 CardTemplate
export async function getCardTemplate(cardTypeId: number): Promise<CardTemplate | null> {
  try {
    const [cardTemplatePDA] = getCardTemplatePDA(cardTypeId)
    const accountInfo = await connection.getAccountInfo(cardTemplatePDA)

    if (accountInfo && accountInfo.data) {
      const template = parseCardTemplate(Buffer.from(accountInfo.data))
      console.log('Card template loaded:', template)
      return template
    }

    return null
  } catch (error) {
    console.error('Error getting card template:', error)
    return null
  }
}

// 单个批次请求，带重试
async function fetchBatchWithRetry(
  batchIds: number[],
  maxRetries: number = 3
): Promise<CardTemplate[]> {
  const pdas = batchIds.map(id => getCardTemplatePDA(id)[0])
  const templates: CardTemplate[] = []

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const accountInfos = await connection.getMultipleAccountsInfo(pdas)

      for (let j = 0; j < accountInfos.length; j++) {
        const accountInfo = accountInfos[j]
        if (accountInfo && accountInfo.data) {
          try {
            const template = parseCardTemplate(Buffer.from(accountInfo.data))
            templates.push(template)
          } catch (e) {
            console.error(`Error parsing card template ${batchIds[j]}:`, e)
          }
        }
      }
      return templates // 成功就返回
    } catch (error) {
      console.warn(`Batch fetch attempt ${attempt + 1} failed:`, error)
      if (attempt < maxRetries - 1) {
        // 等待后重试，指数退避
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
      }
    }
  }

  // 所有重试都失败，逐个请求
  console.log('Batch failed, falling back to individual requests for:', batchIds)
  for (const id of batchIds) {
    try {
      const [pda] = getCardTemplatePDA(id)
      const accountInfo = await connection.getAccountInfo(pda)
      if (accountInfo && accountInfo.data) {
        const template = parseCardTemplate(Buffer.from(accountInfo.data))
        templates.push(template)
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    } catch (e) {
      console.error(`Failed to fetch card ${id}:`, e)
    }
  }

  return templates
}

// 获取多个 CardTemplate (通过 ID 范围，分批请求)
export async function getCardTemplates(cardTypeIds: number[]): Promise<CardTemplate[]> {
  const templates: CardTemplate[] = []
  const BATCH_SIZE = 5 // 减小批次大小，更稳定

  // 分批处理
  for (let i = 0; i < cardTypeIds.length; i += BATCH_SIZE) {
    const batchIds = cardTypeIds.slice(i, i + BATCH_SIZE)
    const batchTemplates = await fetchBatchWithRetry(batchIds)
    templates.push(...batchTemplates)

    // 批次之间延迟
    if (i + BATCH_SIZE < cardTypeIds.length) {
      await new Promise(resolve => setTimeout(resolve, 150))
    }
  }

  // 按 cardTypeId 排序
  templates.sort((a, b) => a.cardTypeId - b.cardTypeId)
  return templates
}

// 获取所有已存在的 CardTemplate (扫描 ID 1-maxId)
export async function getAllCardTemplates(maxId: number = 100): Promise<CardTemplate[]> {
  const cardTypeIds = Array.from({ length: maxId }, (_, i) => i + 1)
  return getCardTemplates(cardTypeIds)
}

// 获取玩家 Profile PDA
export function getPlayerProfilePDA(playerPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('player_profile'), playerPubkey.toBuffer()],
    PROGRAM_ID
  )
}

// 玩家数据类型
export interface PlayerProfile {
  wallet: PublicKey
  username: string
  hasClaimedStarterPack: boolean
  trophies: number
  totalWins: number
  totalLosses: number
}

// 解析 PlayerProfile 账户数据
function parsePlayerProfile(data: Buffer, wallet: PublicKey): PlayerProfile {
  // Anchor 账户结构:
  // 8 bytes: discriminator
  // 32 bytes: wallet (Pubkey)
  // 4 bytes: username length + username bytes
  // 1 byte: has_claimed_starter_pack
  // 4 bytes: trophies (u32)
  // 4 bytes: total_wins (u32)
  // 4 bytes: total_losses (u32)
  // 1 byte: bump

  let offset = 8 // skip discriminator

  // Skip wallet (32 bytes)
  offset += 32

  // Read username (4 bytes length + string)
  const usernameLen = data.readUInt32LE(offset)
  offset += 4
  const username = data.slice(offset, offset + usernameLen).toString('utf-8')
  offset += usernameLen

  // Read has_claimed_starter_pack (1 byte)
  const hasClaimedStarterPack = data[offset] === 1
  offset += 1

  // Read trophies (4 bytes)
  const trophies = data.readUInt32LE(offset)
  offset += 4

  // Read total_wins (4 bytes)
  const totalWins = data.readUInt32LE(offset)
  offset += 4

  // Read total_losses (4 bytes)
  const totalLosses = data.readUInt32LE(offset)

  return {
    wallet,
    username,
    hasClaimedStarterPack,
    trophies,
    totalWins,
    totalLosses,
  }
}

// 获取玩家数据（如果已注册）
export async function getPlayerProfile(
  playerPubkey: PublicKey
): Promise<PlayerProfile | null> {
  try {
    const [playerProfilePDA] = getPlayerProfilePDA(playerPubkey)
    const accountInfo = await connection.getAccountInfo(playerProfilePDA)

    if (accountInfo && accountInfo.data) {
      const profile = parsePlayerProfile(Buffer.from(accountInfo.data), playerPubkey)
      console.log('Player profile loaded:', profile)
      return profile
    }

    console.log('Player not registered yet')
    return null
  } catch (error) {
    console.error('Error getting player profile:', error)
    return null
  }
}

// 检查玩家是否已注册
export async function checkPlayerRegistered(
  playerPubkey: PublicKey
): Promise<boolean> {
  const profile = await getPlayerProfile(playerPubkey)
  return profile !== null
}

// 获取 Phantom provider
function getPhantomProvider(): PhantomWallet {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phantom = (window as any).phantom?.solana || (window as any).solana
  if (!phantom?.isPhantom) {
    throw new Error('Phantom wallet not found')
  }
  return phantom as PhantomWallet
}

// Anchor instruction discriminator for "register_player"
// sha256("global:register_player")[0..8]
function getRegisterPlayerDiscriminator(): Buffer {
  return Buffer.from([242, 146, 194, 234, 234, 145, 228, 42])
}

// 注册玩家
export async function registerPlayer(
  playerPubkey: PublicKey,
  username: string
): Promise<string> {
  const phantom = getPhantomProvider()
  const [playerProfilePDA] = getPlayerProfilePDA(playerPubkey)

  // 构建指令数据
  const usernameBytes = Buffer.from(username, 'utf-8')
  const data = Buffer.concat([
    getRegisterPlayerDiscriminator(),
    // String 长度 (4 bytes, little endian)
    Buffer.from(new Uint8Array(new Uint32Array([usernameBytes.length]).buffer)),
    usernameBytes,
  ])

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: playerProfilePDA, isSigner: false, isWritable: true },
      { pubkey: playerPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  })

  const transaction = new Transaction().add(instruction)
  transaction.feePayer = playerPubkey
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

  // 签名并发送
  const signedTx = await phantom.signTransaction(transaction)
  const txId = await connection.sendRawTransaction(signedTx.serialize())

  await connection.confirmTransaction(txId, 'confirmed')
  console.log('Player registered! TX:', txId)

  return txId
}
