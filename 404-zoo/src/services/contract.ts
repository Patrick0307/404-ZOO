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

// Contract Program ID (新合约，无 SPL Token)
export const PROGRAM_ID = new PublicKey('Fs2LFWmDjqKt16ojH8sPuDgw2mTfqmobQbNcj5nhxVot')

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
  Legendary: 2,
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
  [Rarity.Legendary]: 'Legendary',
}

export const RarityColors: Record<Rarity, string> = {
  [Rarity.Common]: '#9e9e9e',
  [Rarity.Rare]: '#2196f3',
  [Rarity.Legendary]: '#ff9800',
}

// 反向映射：数字 -> 名称
export const RarityToName: Record<Rarity, string> = {
  [Rarity.Common]: 'common',
  [Rarity.Rare]: 'rare',
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
  gachaTickets: number
  bugBalance: number  // BUG 代币余额（游戏内货币）
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
  // 8 bytes: gacha_tickets (u64)
  // 8 bytes: bug_balance (u64)
  // 4 bytes: trophies (u32)
  // 4 bytes: total_wins (u32)
  // 4 bytes: total_losses (u32)
  // 4 bytes: win_streak (u32)
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

  // Read gacha_tickets (8 bytes, u64)
  const gachaTickets = Number(data.readBigUInt64LE(offset))
  offset += 8

  // Read bug_balance (8 bytes, u64)
  const bugBalance = Number(data.readBigUInt64LE(offset))
  offset += 8

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
    gachaTickets,
    bugBalance,
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

// 获取所有玩家的 Profile（用于排行榜）
export async function getAllPlayerProfiles(): Promise<PlayerProfile[]> {
  try {
    // PlayerProfile::LEN = 8 + 32 + 4 + 32 + 1 + 8 + 8 + 4 + 4 + 4 + 4 + 1 = 110
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { dataSize: 110 }, // PlayerProfile account size
      ],
    })

    const profiles: PlayerProfile[] = []
    for (const { account, pubkey } of accounts) {
      try {
        // 从账户数据中读取 wallet
        const walletBytes = account.data.slice(8, 40)
        const wallet = new PublicKey(walletBytes)
        const profile = parsePlayerProfile(Buffer.from(account.data), wallet)
        profiles.push(profile)
      } catch (e) {
        console.error('Error parsing player profile:', pubkey.toBase58(), e)
      }
    }

    // 按 trophies 降序排序
    profiles.sort((a, b) => b.trophies - a.trophies)
    
    console.log(`Loaded ${profiles.length} player profiles for leaderboard`)
    return profiles
  } catch (error) {
    console.error('Error getting all player profiles:', error)
    return []
  }
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

// Anchor instruction discriminator for "claim_starter_tickets"
// sha256("global:claim_starter_tickets")[0..8]
function getClaimStarterTicketsDiscriminator(): Buffer {
  return Buffer.from([214, 233, 29, 2, 213, 209, 173, 102])
}

// Anchor instruction discriminator for "gacha_draw"
// sha256("global:gacha_draw")[0..8]
function getGachaDrawDiscriminator(): Buffer {
  return Buffer.from([250, 36, 118, 2, 221, 236, 213, 11])
}

// 获取 GameConfig PDA
export function getGameConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('game_config')],
    PROGRAM_ID
  )
}

// 获取 CardInstance PDA
export function getCardInstancePDA(mintPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('card_instance'), mintPubkey.toBuffer()],
    PROGRAM_ID
  )
}

// CardInstance 类型（玩家拥有的卡牌实例）
export interface CardInstance {
  mint: PublicKey
  cardTypeId: number
  attack: number
  health: number
  owner: PublicKey
}

// 解析 CardInstance 账户数据
function parseCardInstance(data: Buffer): CardInstance {
  // 8 bytes discriminator + 32 mint + 4 card_type_id + 2 attack + 2 health + 32 owner + 1 bump
  let offset = 8 // skip discriminator

  const mint = new PublicKey(data.slice(offset, offset + 32))
  offset += 32

  const cardTypeId = data.readUInt32LE(offset)
  offset += 4

  const attack = data.readUInt16LE(offset)
  offset += 2

  const health = data.readUInt16LE(offset)
  offset += 2

  const owner = new PublicKey(data.slice(offset, offset + 32))

  return { mint, cardTypeId, attack, health, owner }
}

// 获取玩家拥有的所有卡牌
export async function getPlayerCards(playerPubkey: PublicKey): Promise<CardInstance[]> {
  try {
    // 使用 getProgramAccounts 查询所有 CardInstance，过滤 owner
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [
        { dataSize: 81 }, // CardInstance::LEN = 8 + 32 + 4 + 2 + 2 + 32 + 1 = 81
        {
          memcmp: {
            offset: 8 + 32 + 4 + 2 + 2, // skip discriminator + mint + card_type_id + attack + health
            bytes: playerPubkey.toBase58(),
          },
        },
      ],
    })

    const cards: CardInstance[] = []
    for (const { account } of accounts) {
      try {
        const card = parseCardInstance(Buffer.from(account.data))
        cards.push(card)
      } catch (e) {
        console.error('Error parsing card instance:', e)
      }
    }

    console.log(`Found ${cards.length} cards for player ${playerPubkey.toBase58()}`)
    return cards
  } catch (error) {
    console.error('Error getting player cards:', error)
    return []
  }
}

// 获取玩家卡牌的完整信息（包含模板数据）
export interface PlayerCard {
  instance: CardInstance
  template: CardTemplate | null
}

export async function getPlayerCardsWithTemplates(
  playerPubkey: PublicKey
): Promise<PlayerCard[]> {
  const instances = await getPlayerCards(playerPubkey)
  
  const playerCards: PlayerCard[] = []
  for (const instance of instances) {
    const template = await getCardTemplate(instance.cardTypeId)
    playerCards.push({ instance, template })
  }
  
  return playerCards
}

// 获取 RarityPool PDA
export function getRarityPoolPDA(rarityDiscriminant: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('rarity_pool'), Buffer.from([rarityDiscriminant])],
    PROGRAM_ID
  )
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


// 领取免费10张抽奖券（新玩家）
export async function claimStarterTickets(
  playerPubkey: PublicKey
): Promise<string> {
  const phantom = getPhantomProvider()
  const [playerProfilePDA] = getPlayerProfilePDA(playerPubkey)

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: playerProfilePDA, isSigner: false, isWritable: true },
      { pubkey: playerPubkey, isSigner: true, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data: getClaimStarterTicketsDiscriminator(),
  })

  const transaction = new Transaction().add(instruction)
  transaction.feePayer = playerPubkey
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

  const signedTx = await phantom.signTransaction(transaction)
  const txId = await connection.sendRawTransaction(signedTx.serialize())

  await connection.confirmTransaction(txId, 'confirmed')
  console.log('Starter tickets claimed! TX:', txId)

  return txId
}

// 抽卡结果类型
export interface GachaDrawResult {
  txId: string
  cardTypeId: number
  mintAddress: string
}

// SPL Token Program ID
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
// Associated Token Program ID
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
// Rent Sysvar
const RENT_SYSVAR_ID = new PublicKey('SysvarRent111111111111111111111111111111111')

// 获取 Associated Token Address
function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  return address
}

// 缓存已加载的卡片模板（按稀有度分组）
let cachedCardsByRarity: Map<number, CardTemplate[]> | null = null

// 加载所有卡片模板并按稀有度分组
async function loadCardsByRarity(): Promise<Map<number, CardTemplate[]>> {
  if (cachedCardsByRarity) {
    return cachedCardsByRarity
  }

  const allCards = await getAllCardTemplates(50) // 扫描前50个ID
  const byRarity = new Map<number, CardTemplate[]>()

  for (const card of allCards) {
    const list = byRarity.get(card.rarity) || []
    list.push(card)
    byRarity.set(card.rarity, list)
  }

  cachedCardsByRarity = byRarity
  console.log('Cards loaded by rarity:', {
    common: byRarity.get(Rarity.Common)?.length || 0,
    rare: byRarity.get(Rarity.Rare)?.length || 0,
    legendary: byRarity.get(Rarity.Legendary)?.length || 0,
  })

  return byRarity
}

// 清除缓存（如果需要刷新）
export function clearCardCache() {
  cachedCardsByRarity = null
}

// 客户端 roll rarity (模拟合约逻辑: 70% common, 27% rare, 3% legendary)
function rollRarityClient(): number {
  const roll = Math.floor(Math.random() * 100)
  if (roll < 70) return Rarity.Common
  if (roll < 97) return Rarity.Rare
  return Rarity.Legendary
}

// 使用抽奖券抽卡（单抽）
export async function gachaDraw(
  playerPubkey: PublicKey
): Promise<GachaDrawResult> {
  const phantom = getPhantomProvider()
  const [playerProfilePDA] = getPlayerProfilePDA(playerPubkey)
  const [gameConfigPDA] = getGameConfigPDA()

  // 1. 加载卡片模板
  const cardsByRarity = await loadCardsByRarity()

  // 2. Roll rarity 并选择卡片
  let rarity = rollRarityClient()
  let cards = cardsByRarity.get(rarity)

  // 如果该稀有度没有卡，降级到有卡的稀有度
  if (!cards || cards.length === 0) {
    // 尝试其他稀有度
    for (const r of [Rarity.Common, Rarity.Rare, Rarity.Legendary]) {
      cards = cardsByRarity.get(r)
      if (cards && cards.length > 0) {
        rarity = r
        break
      }
    }
  }

  if (!cards || cards.length === 0) {
    throw new Error('No card templates found! Please create some cards first.')
  }

  const selectedCard = cards[Math.floor(Math.random() * cards.length)]
  const cardTypeId = selectedCard.cardTypeId
  const [cardTemplatePDA] = getCardTemplatePDA(cardTypeId)

  console.log(`Rolling: ${RarityNames[rarity as Rarity]} - ${selectedCard.name} (ID: ${cardTypeId})`)
  
  // 2. 创建新的 mint keypair
  const { Keypair } = await import('@solana/web3.js')
  const mintKeypair = Keypair.generate()
  const mintPubkey = mintKeypair.publicKey
  
  // 3. 计算 PDAs
  const playerTokenAccount = getAssociatedTokenAddress(mintPubkey, playerPubkey)
  const [cardInstancePDA] = getCardInstancePDA(mintPubkey)
  
  // 4. 创建 mint account 的指令 (需要先初始化 mint)
  const mintRent = await connection.getMinimumBalanceForRentExemption(82) // Mint account size
  
  const createMintAccountIx = SystemProgram.createAccount({
    fromPubkey: playerPubkey,
    newAccountPubkey: mintPubkey,
    space: 82,
    lamports: mintRent,
    programId: TOKEN_PROGRAM_ID,
  })
  
  // 5. 初始化 mint 指令 (mint authority = game_config PDA)
  // Use InitializeMint2 (instruction index 20) - doesn't require rent sysvar in accounts
  // InitializeMint2 instruction layout:
  // - 1 byte: instruction index (20)
  // - 1 byte: decimals
  // - 32 bytes: mint authority
  // - 1 byte: freeze authority option (0 = None, 1 = Some)
  const initMintData = Buffer.alloc(35)
  initMintData.writeUInt8(20, 0) // InitializeMint2 instruction
  initMintData.writeUInt8(0, 1) // decimals = 0 for NFT
  gameConfigPDA.toBuffer().copy(initMintData, 2) // mint authority (32 bytes)
  initMintData.writeUInt8(0, 34) // no freeze authority (COption::None)

  const initMintIx = new TransactionInstruction({
    keys: [{ pubkey: mintPubkey, isSigner: false, isWritable: true }],
    programId: TOKEN_PROGRAM_ID,
    data: initMintData,
  })
  
  // 6. gacha_draw 指令
  const gachaDrawIx = new TransactionInstruction({
    keys: [
      { pubkey: playerProfilePDA, isSigner: false, isWritable: true },
      { pubkey: gameConfigPDA, isSigner: false, isWritable: false },
      { pubkey: cardTemplatePDA, isSigner: false, isWritable: false },
      { pubkey: mintPubkey, isSigner: false, isWritable: true },
      { pubkey: playerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: cardInstancePDA, isSigner: false, isWritable: true },
      { pubkey: playerPubkey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: RENT_SYSVAR_ID, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: getGachaDrawDiscriminator(),
  })

  const transaction = new Transaction()
    .add(createMintAccountIx)
    .add(initMintIx)
    .add(gachaDrawIx)
  
  transaction.feePayer = playerPubkey
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  
  // mint keypair 需要签名
  transaction.partialSign(mintKeypair)

  const signedTx = await phantom.signTransaction(transaction)
  const txId = await connection.sendRawTransaction(signedTx.serialize())

  await connection.confirmTransaction(txId, 'confirmed')
  console.log(`Gacha draw complete! Card: ${cardTypeId}, Mint: ${mintPubkey.toBase58()}, TX:`, txId)

  return { 
    txId, 
    cardTypeId,
    mintAddress: mintPubkey.toBase58()
  }
}

// ============================================================================
// 卡组 (Deck) 相关功能
// ============================================================================

// 获取 PlayerDeck PDA
export function getPlayerDeckPDA(playerPubkey: PublicKey, deckIndex: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('player_deck'), playerPubkey.toBuffer(), Buffer.from([deckIndex])],
    PROGRAM_ID
  )
}

// PlayerDeck 类型
export interface PlayerDeck {
  owner: PublicKey
  deckIndex: number
  deckName: string
  cardMints: PublicKey[]
  isActive: boolean
}

// 解析 PlayerDeck 账户数据
function parsePlayerDeck(data: Buffer): PlayerDeck {
  // 8 (discriminator) + 32 (owner) + 1 (deck_index) + 4 + 32 (deck_name) 
  // + 4 + (32 * n) (card_mints vec) + 1 (is_active) + 1 (bump)
  let offset = 8 // skip discriminator

  const owner = new PublicKey(data.slice(offset, offset + 32))
  offset += 32

  const deckIndex = data[offset]
  offset += 1

  const nameLen = data.readUInt32LE(offset)
  offset += 4
  const deckName = data.slice(offset, offset + nameLen).toString('utf-8')
  offset += nameLen

  const mintsLen = data.readUInt32LE(offset)
  offset += 4
  const cardMints: PublicKey[] = []
  for (let i = 0; i < mintsLen; i++) {
    cardMints.push(new PublicKey(data.slice(offset, offset + 32)))
    offset += 32
  }

  const isActive = data[offset] === 1

  return { owner, deckIndex, deckName, cardMints, isActive }
}

// 获取玩家的单个卡组
export async function getPlayerDeck(playerPubkey: PublicKey, deckIndex: number): Promise<PlayerDeck | null> {
  try {
    const [deckPDA] = getPlayerDeckPDA(playerPubkey, deckIndex)
    const accountInfo = await connection.getAccountInfo(deckPDA)

    if (accountInfo && accountInfo.data) {
      const deck = parsePlayerDeck(Buffer.from(accountInfo.data))
      if (deck.isActive) {
        return deck
      }
    }
    return null
  } catch (error) {
    console.error('Error getting player deck:', error)
    return null
  }
}

// 获取玩家的所有卡组 (最多5个)
export async function getPlayerDecks(playerPubkey: PublicKey): Promise<PlayerDeck[]> {
  const decks: PlayerDeck[] = []
  
  for (let i = 0; i < 5; i++) {
    const deck = await getPlayerDeck(playerPubkey, i)
    if (deck) {
      decks.push(deck)
    }
  }
  
  return decks
}

// Anchor instruction discriminator for "save_deck"
// sha256("global:save_deck")[0..8]
function getSaveDeckDiscriminator(): Buffer {
  return Buffer.from([60, 123, 78, 73, 68, 233, 192, 56])
}

// Anchor instruction discriminator for "delete_deck"
// sha256("global:delete_deck")[0..8]
function getDeleteDeckDiscriminator(): Buffer {
  return Buffer.from([200, 213, 71, 120, 161, 65, 82, 101])
}

// 保存卡组到链上
export async function saveDeck(
  playerPubkey: PublicKey,
  deckIndex: number,
  deckName: string,
  cardMints: PublicKey[]
): Promise<string> {
  const phantom = getPhantomProvider()
  const [playerDeckPDA] = getPlayerDeckPDA(playerPubkey, deckIndex)

  // 构建指令数据
  // discriminator (8) + deck_index (1 byte) + deck_name (4 + len) + card_mints vec (4 + 32*n)
  const nameBytes = Buffer.from(deckName, 'utf-8')
  
  const dataSize = 8 + 1 + 4 + nameBytes.length + 4 + (32 * cardMints.length)
  const data = Buffer.alloc(dataSize)
  let offset = 0
  
  // Discriminator
  const discriminator = getSaveDeckDiscriminator()
  discriminator.copy(data, offset)
  offset += 8
  
  // deck_index
  data.writeUInt8(deckIndex, offset)
  offset += 1
  
  // deck_name (string: 4 bytes len + bytes)
  data.writeUInt32LE(nameBytes.length, offset)
  offset += 4
  nameBytes.copy(data, offset)
  offset += nameBytes.length
  
  // card_mints (vec: 4 bytes len + pubkeys)
  data.writeUInt32LE(cardMints.length, offset)
  offset += 4
  for (const mint of cardMints) {
    mint.toBuffer().copy(data, offset)
    offset += 32
  }

  console.log('saveDeck debug:', {
    discriminator: Array.from(discriminator),
    deckIndex,
    deckName,
    cardMintsCount: cardMints.length,
    dataHex: data.toString('hex').slice(0, 50) + '...',
    playerDeckPDA: playerDeckPDA.toBase58(),
  })

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: playerDeckPDA, isSigner: false, isWritable: true },
      { pubkey: playerPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  })

  const transaction = new Transaction().add(instruction)
  transaction.feePayer = playerPubkey
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

  const signedTx = await phantom.signTransaction(transaction)
  const txId = await connection.sendRawTransaction(signedTx.serialize())

  await connection.confirmTransaction(txId, 'confirmed')
  console.log(`Deck saved! Index: ${deckIndex}, Name: ${deckName}, TX:`, txId)

  return txId
}

// 删除卡组
export async function deleteDeck(
  playerPubkey: PublicKey,
  deckIndex: number
): Promise<string> {
  const phantom = getPhantomProvider()
  const [playerDeckPDA] = getPlayerDeckPDA(playerPubkey, deckIndex)

  // 构建指令数据: discriminator + deck_index
  const data = Buffer.alloc(9)
  getDeleteDeckDiscriminator().copy(data, 0)
  data.writeUInt8(deckIndex, 8)

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: playerDeckPDA, isSigner: false, isWritable: true },
      { pubkey: playerPubkey, isSigner: true, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  })

  const transaction = new Transaction().add(instruction)
  transaction.feePayer = playerPubkey
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

  const signedTx = await phantom.signTransaction(transaction)
  const txId = await connection.sendRawTransaction(signedTx.serialize())

  await connection.confirmTransaction(txId, 'confirmed')
  console.log(`Deck deleted! Index: ${deckIndex}, TX:`, txId)

  return txId
}

// ============================================================================
// Marketplace 相关功能
// ============================================================================

// 获取 Listing PDA
export function getListingPDA(cardMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('listing'), cardMint.toBuffer()],
    PROGRAM_ID
  )
}

// 获取 Escrow Token Account PDA
export function getEscrowPDA(cardMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), cardMint.toBuffer()],
    PROGRAM_ID
  )
}

// Listing 类型
export interface Listing {
  seller: PublicKey
  cardMint: PublicKey
  price: number
  isActive: boolean
  createdAt: number
}

// 解析 Listing 账户数据
function parseListing(data: Buffer): Listing {
  // 8 (discriminator) + 32 (seller) + 32 (card_mint) + 8 (price) + 1 (is_active) + 8 (created_at) + 1 (bump)
  let offset = 8 // skip discriminator

  const seller = new PublicKey(data.slice(offset, offset + 32))
  offset += 32

  const cardMint = new PublicKey(data.slice(offset, offset + 32))
  offset += 32

  const price = Number(data.readBigUInt64LE(offset))
  offset += 8

  const isActive = data[offset] === 1
  offset += 1

  const createdAt = Number(data.readBigInt64LE(offset))

  return { seller, cardMint, price, isActive, createdAt }
}

// 获取所有活跃的 Listings
export async function getActiveListings(): Promise<Listing[]> {
  try {
    // 只按 dataSize 过滤，然后在代码中检查 is_active
    const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: [{ dataSize: 90 }], // Listing::LEN = 8 + 32 + 32 + 8 + 1 + 8 + 1 = 90
    })

    console.log(`Found ${accounts.length} listing accounts`)

    const listings: Listing[] = []
    for (const { account } of accounts) {
      try {
        const listing = parseListing(Buffer.from(account.data))
        console.log('Parsed listing:', listing.cardMint.toBase58(), 'isActive:', listing.isActive)
        if (listing.isActive) {
          listings.push(listing)
        }
      } catch (e) {
        console.error('Error parsing listing:', e)
      }
    }

    console.log(`Found ${listings.length} active listings`)
    return listings
  } catch (error) {
    console.error('Error getting active listings:', error)
    return []
  }
}

// 获取 Listing 的完整信息（包含卡牌数据）
export interface ListingWithCard {
  listing: Listing
  cardInstance: CardInstance | null
  cardTemplate: CardTemplate | null
}

export async function getListingsWithCards(): Promise<ListingWithCard[]> {
  const listings = await getActiveListings()
  const result: ListingWithCard[] = []

  for (const listing of listings) {
    try {
      const [cardInstancePDA] = getCardInstancePDA(listing.cardMint)
      const accountInfo = await connection.getAccountInfo(cardInstancePDA)
      
      let cardInstance: CardInstance | null = null
      let cardTemplate: CardTemplate | null = null

      if (accountInfo && accountInfo.data) {
        cardInstance = parseCardInstance(Buffer.from(accountInfo.data))
        cardTemplate = await getCardTemplate(cardInstance.cardTypeId)
      }

      result.push({ listing, cardInstance, cardTemplate })
    } catch (e) {
      console.error('Error getting card for listing:', e)
      result.push({ listing, cardInstance: null, cardTemplate: null })
    }
  }

  return result
}

// Anchor instruction discriminator for "list_card"
// sha256("global:list_card")[0..8]
function getListCardDiscriminator(): Buffer {
  return Buffer.from([113, 226, 80, 193, 197, 19, 75, 161])
}

// Anchor instruction discriminator for "cancel_listing"
// sha256("global:cancel_listing")[0..8]
function getCancelListingDiscriminator(): Buffer {
  return Buffer.from([41, 183, 50, 232, 230, 233, 157, 70])
}

// Anchor instruction discriminator for "buy_card"
// sha256("global:buy_card")[0..8]
function getBuyCardDiscriminator(): Buffer {
  return Buffer.from([113, 142, 149, 246, 22, 115, 156, 154])
}

// 上架卡牌到市场
export async function listCard(
  sellerPubkey: PublicKey,
  cardMint: PublicKey,
  price: number
): Promise<string> {
  const phantom = getPhantomProvider()
  const [listingPDA] = getListingPDA(cardMint)
  
  // 获取 seller 的 token account
  const sellerTokenAccount = getAssociatedTokenAddress(cardMint, sellerPubkey)
  
  // Escrow token account (PDA-based, not ATA)
  const [escrowTokenAccount] = getEscrowPDA(cardMint)

  // 构建指令数据: discriminator + price (u64)
  const data = Buffer.alloc(16)
  getListCardDiscriminator().copy(data, 0)
  // 手动写入 u64 (little endian)
  const priceBuffer = Buffer.alloc(8)
  priceBuffer.writeUInt32LE(price & 0xFFFFFFFF, 0)
  priceBuffer.writeUInt32LE(Math.floor(price / 0x100000000), 4)
  priceBuffer.copy(data, 8)

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: listingPDA, isSigner: false, isWritable: true },
      { pubkey: cardMint, isSigner: false, isWritable: false },
      { pubkey: sellerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: escrowTokenAccount, isSigner: false, isWritable: true },
      { pubkey: sellerPubkey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: RENT_SYSVAR_ID, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  })

  const transaction = new Transaction().add(instruction)
  transaction.feePayer = sellerPubkey
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

  const signedTx = await phantom.signTransaction(transaction)
  const txId = await connection.sendRawTransaction(signedTx.serialize())

  await connection.confirmTransaction(txId, 'confirmed')
  console.log(`Card listed! Mint: ${cardMint.toBase58()}, Price: ${price}, TX:`, txId)

  return txId
}

// 取消上架
export async function cancelListing(
  sellerPubkey: PublicKey,
  cardMint: PublicKey
): Promise<string> {
  const phantom = getPhantomProvider()
  const [listingPDA] = getListingPDA(cardMint)
  
  const sellerTokenAccount = getAssociatedTokenAddress(cardMint, sellerPubkey)
  const [escrowTokenAccount] = getEscrowPDA(cardMint)

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: listingPDA, isSigner: false, isWritable: true },
      { pubkey: cardMint, isSigner: false, isWritable: false },
      { pubkey: sellerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: escrowTokenAccount, isSigner: false, isWritable: true },
      { pubkey: sellerPubkey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: getCancelListingDiscriminator(),
  })

  const transaction = new Transaction().add(instruction)
  transaction.feePayer = sellerPubkey
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

  const signedTx = await phantom.signTransaction(transaction)
  const txId = await connection.sendRawTransaction(signedTx.serialize())

  await connection.confirmTransaction(txId, 'confirmed')
  console.log(`Listing cancelled! Mint: ${cardMint.toBase58()}, TX:`, txId)

  return txId
}

// 购买卡牌 (使用 PlayerProfile 中的 BUG 余额)
export async function buyCard(
  buyerPubkey: PublicKey,
  cardMint: PublicKey,
  sellerPubkey: PublicKey
): Promise<string> {
  const phantom = getPhantomProvider()
  const [listingPDA] = getListingPDA(cardMint)
  const [buyerProfilePDA] = getPlayerProfilePDA(buyerPubkey)
  const [sellerProfilePDA] = getPlayerProfilePDA(sellerPubkey)
  const [cardInstancePDA] = getCardInstancePDA(cardMint)
  
  const [escrowTokenAccount] = getEscrowPDA(cardMint)
  const buyerTokenAccount = getAssociatedTokenAddress(cardMint, buyerPubkey)

  console.log('buyCard accounts:', {
    listing: listingPDA.toBase58(),
    seller: sellerPubkey.toBase58(),
    buyerProfile: buyerProfilePDA.toBase58(),
    sellerProfile: sellerProfilePDA.toBase58(),
    cardMint: cardMint.toBase58(),
    cardInstance: cardInstancePDA.toBase58(),
    escrowToken: escrowTokenAccount.toBase58(),
    buyerToken: buyerTokenAccount.toBase58(),
    buyer: buyerPubkey.toBase58(),
  })

  // 验证买家和卖家的 PlayerProfile 是否存在
  const buyerProfileInfo = await connection.getAccountInfo(buyerProfilePDA)
  const sellerProfileInfo = await connection.getAccountInfo(sellerProfilePDA)
  
  console.log('Profile verification:', {
    buyerProfileExists: !!buyerProfileInfo,
    buyerProfileOwner: buyerProfileInfo?.owner?.toBase58(),
    sellerProfileExists: !!sellerProfileInfo,
    sellerProfileOwner: sellerProfileInfo?.owner?.toBase58(),
  })

  if (!buyerProfileInfo || buyerProfileInfo.owner.toBase58() !== PROGRAM_ID.toBase58()) {
    throw new Error(`Buyer profile not found or not initialized. Please register first. Owner: ${buyerProfileInfo?.owner?.toBase58() || 'null'}`)
  }
  
  if (!sellerProfileInfo || sellerProfileInfo.owner.toBase58() !== PROGRAM_ID.toBase58()) {
    throw new Error(`Seller profile not found or not initialized. Owner: ${sellerProfileInfo?.owner?.toBase58() || 'null'}`)
  }

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: listingPDA, isSigner: false, isWritable: true },
      { pubkey: sellerPubkey, isSigner: false, isWritable: true },  // seller 接收租金退款
      { pubkey: buyerProfilePDA, isSigner: false, isWritable: true },
      { pubkey: sellerProfilePDA, isSigner: false, isWritable: true },
      { pubkey: cardMint, isSigner: false, isWritable: false },
      { pubkey: cardInstancePDA, isSigner: false, isWritable: true },
      { pubkey: escrowTokenAccount, isSigner: false, isWritable: true },
      { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
      { pubkey: buyerPubkey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: RENT_SYSVAR_ID, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: getBuyCardDiscriminator(),
  })

  const transaction = new Transaction().add(instruction)
  transaction.feePayer = buyerPubkey
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

  const signedTx = await phantom.signTransaction(transaction)
  const txId = await connection.sendRawTransaction(signedTx.serialize())

  await connection.confirmTransaction(txId, 'confirmed')
  console.log(`Card bought! Mint: ${cardMint.toBase58()}, TX:`, txId)

  return txId
}

// 检查卡牌是否已上架
export async function getCardListing(cardMint: PublicKey): Promise<Listing | null> {
  try {
    const [listingPDA] = getListingPDA(cardMint)
    const accountInfo = await connection.getAccountInfo(listingPDA)

    if (accountInfo && accountInfo.data) {
      const listing = parseListing(Buffer.from(accountInfo.data))
      if (listing.isActive) {
        return listing
      }
    }
    return null
  } catch (error) {
    console.error('Error getting card listing:', error)
    return null
  }
}

// ============================================================================
// BUG Token 购买功能
// ============================================================================

// Anchor instruction discriminator for "buy_bug_tokens"
// sha256("global:buy_bug_tokens")[0..8]
function getBuyBugTokensDiscriminator(): Buffer {
  return Buffer.from([238, 26, 9, 188, 146, 2, 121, 91])
}

// Treasury 地址 (authority)
export const TREASURY = new PublicKey('71XmXhn6ZTtEea71D6jJC7WyYLtx49hVX63bzGLVMo3L')

// GameConfig 类型 (不再包含 bugTokenMint，BUG 余额存在 PlayerProfile 里)
export interface GameConfig {
  authority: PublicKey
  cardCreators: PublicKey[]
  normalPackPrice: number
  starterPackCardCount: number
  solToBugRate: number
  ticketPrice: number
  bump: number
}

// 解析 GameConfig 账户数据
function parseGameConfig(data: Buffer): GameConfig {
  // 8 (discriminator) + 32 (authority) + 4 + (32 * n) (card_creators vec) 
  // + 8 (normal_pack_price) + 1 (starter_pack_card_count) 
  // + 8 (sol_to_bug_rate) + 8 (ticket_price) + 1 (bump)
  let offset = 8 // skip discriminator

  const authority = new PublicKey(data.slice(offset, offset + 32))
  offset += 32

  // card_creators vec
  const creatorsLen = data.readUInt32LE(offset)
  offset += 4
  const cardCreators: PublicKey[] = []
  for (let i = 0; i < creatorsLen; i++) {
    cardCreators.push(new PublicKey(data.slice(offset, offset + 32)))
    offset += 32
  }

  const normalPackPrice = Number(data.readBigUInt64LE(offset))
  offset += 8

  const starterPackCardCount = data[offset]
  offset += 1

  const solToBugRate = Number(data.readBigUInt64LE(offset))
  offset += 8

  const ticketPrice = Number(data.readBigUInt64LE(offset))
  offset += 8

  const bump = data[offset]

  return {
    authority,
    cardCreators,
    normalPackPrice,
    starterPackCardCount,
    solToBugRate,
    ticketPrice,
    bump,
  }
}

// 获取链上 GameConfig
export async function getGameConfig(): Promise<GameConfig | null> {
  try {
    const [gameConfigPDA] = getGameConfigPDA()
    const accountInfo = await connection.getAccountInfo(gameConfigPDA)

    if (accountInfo && accountInfo.data) {
      const config = parseGameConfig(Buffer.from(accountInfo.data))
      console.log('GameConfig loaded:', {
        authority: config.authority.toBase58(),
        solToBugRate: config.solToBugRate,
        ticketPrice: config.ticketPrice,
      })
      return config
    }
    return null
  } catch (error) {
    console.error('Error getting game config:', error)
    return null
  }
}

// 用 SOL 购买 BUG 代币 (余额存在 PlayerProfile 里)
export async function buyBugTokens(
  playerPubkey: PublicKey,
  solAmount: number // lamports
): Promise<string> {
  const phantom = getPhantomProvider()
  const [gameConfigPDA] = getGameConfigPDA()
  const [playerProfilePDA] = getPlayerProfilePDA(playerPubkey)

  // 构建指令数据: discriminator + sol_amount (u64)
  const data = Buffer.alloc(16)
  getBuyBugTokensDiscriminator().copy(data, 0)
  // 手动写入 u64 (little endian)
  const amountBuffer = Buffer.alloc(8)
  amountBuffer.writeUInt32LE(solAmount & 0xffffffff, 0)
  amountBuffer.writeUInt32LE(Math.floor(solAmount / 0x100000000), 4)
  amountBuffer.copy(data, 8)

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: gameConfigPDA, isSigner: false, isWritable: false },
      { pubkey: playerProfilePDA, isSigner: false, isWritable: true },
      { pubkey: TREASURY, isSigner: false, isWritable: true },
      { pubkey: playerPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  })

  const transaction = new Transaction().add(instruction)
  transaction.feePayer = playerPubkey
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

  const signedTx = await phantom.signTransaction(transaction)
  const txId = await connection.sendRawTransaction(signedTx.serialize())

  await connection.confirmTransaction(txId, 'confirmed')
  console.log(`Bought BUG tokens for ${solAmount} lamports, TX:`, txId)

  return txId
}

// 获取玩家的 BUG 代币余额 (从 PlayerProfile 读取)
export async function getPlayerBugBalance(playerPubkey: PublicKey): Promise<number> {
  try {
    const profile = await getPlayerProfile(playerPubkey)
    return profile?.bugBalance || 0
  } catch (error) {
    console.error('Error getting BUG balance:', error)
    return 0
  }
}
