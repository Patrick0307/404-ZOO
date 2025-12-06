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
