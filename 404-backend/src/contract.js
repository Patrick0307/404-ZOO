import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  Keypair,
  clusterApiUrl,
} from '@solana/web3.js'
import bs58 from 'bs58'
import dotenv from 'dotenv'

dotenv.config()

// Contract Program ID
const PROGRAM_ID = new PublicKey('Fs2LFWmDjqKt16ojH8sPuDgw2mTfqmobQbNcj5nhxVot')

// Devnet connection
const connection = new Connection(
  process.env.SOLANA_RPC_URL || clusterApiUrl('devnet'),
  'confirmed'
)

// Authority keypair (loaded from environment variable)
let authorityKeypair = null

function getAuthorityKeypair() {
  if (authorityKeypair) return authorityKeypair
  
  const privateKey = process.env.AUTHORITY_PRIVATE_KEY
  if (!privateKey) {
    console.warn('⚠️ AUTHORITY_PRIVATE_KEY not set, trophy updates will be disabled')
    return null
  }
  
  try {
    const secretKey = bs58.decode(privateKey)
    authorityKeypair = Keypair.fromSecretKey(secretKey)
    console.log('✅ Authority loaded:', authorityKeypair.publicKey.toBase58())
    return authorityKeypair
  } catch (error) {
    console.error('❌ Failed to load authority keypair:', error.message)
    return null
  }
}

// Get GameConfig PDA
function getGameConfigPDA() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('game_config')],
    PROGRAM_ID
  )
}

// Get PlayerProfile PDA
function getPlayerProfilePDA(playerPubkey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('player_profile'), playerPubkey.toBuffer()],
    PROGRAM_ID
  )
}

// Anchor instruction discriminator for "record_match_result"
// sha256("global:record_match_result")[0..8]
function getRecordMatchResultDiscriminator() {
  return Buffer.from([37, 251, 4, 178, 56, 184, 50, 210])
}

/**
 * Record match result on-chain
 * @param {string} winnerWallet - Winner's wallet address (base58)
 * @param {string} loserWallet - Loser's wallet address (base58)
 * @returns {Promise<{success: boolean, txId?: string, error?: string}>}
 */
export async function recordMatchResult(winnerWallet, loserWallet) {
  const authority = getAuthorityKeypair()
  if (!authority) {
    return { success: false, error: 'Authority not configured' }
  }
  
  try {
    const winnerPubkey = new PublicKey(winnerWallet)
    const loserPubkey = new PublicKey(loserWallet)
    
    const [winnerProfilePDA] = getPlayerProfilePDA(winnerPubkey)
    const [loserProfilePDA] = getPlayerProfilePDA(loserPubkey)
    const [gameConfigPDA] = getGameConfigPDA()
    
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: winnerProfilePDA, isSigner: false, isWritable: true },
        { pubkey: loserProfilePDA, isSigner: false, isWritable: true },
        { pubkey: gameConfigPDA, isSigner: false, isWritable: false },
        { pubkey: authority.publicKey, isSigner: true, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: getRecordMatchResultDiscriminator(),
    })
    
    const transaction = new Transaction().add(instruction)
    transaction.feePayer = authority.publicKey
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
    
    transaction.sign(authority)
    
    const txId = await connection.sendRawTransaction(transaction.serialize())
    await connection.confirmTransaction(txId, 'confirmed')
    
    console.log(`✅ Match result recorded: winner=${winnerWallet.slice(0, 8)}..., loser=${loserWallet.slice(0, 8)}..., tx=${txId}`)
    
    return { success: true, txId }
  } catch (error) {
    console.error('❌ Failed to record match result:', error.message)
    return { success: false, error: error.message }
  }
}

export { getAuthorityKeypair, connection }
