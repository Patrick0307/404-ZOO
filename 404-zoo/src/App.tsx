import { useState, useEffect } from 'react'
import { PublicKey } from '@solana/web3.js'
import ConnectWallet from './components/ConnectWallet'
import MainLayout from './components/MainLayout'
import {
  getPlayerProfile,
  registerPlayer,
  type PlayerProfile,
} from './services/contract'

function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null)
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const isRegistered = playerProfile !== null

  // 检查玩家是否已注册并获取数据
  useEffect(() => {
    async function loadPlayerProfile() {
      if (publicKey && isConnected) {
        setIsLoading(true)
        const profile = await getPlayerProfile(publicKey)
        setPlayerProfile(profile)
        setIsLoading(false)
        console.log('Player profile:', profile)
      }
    }
    loadPlayerProfile()
  }, [publicKey, isConnected])

  const handleConnect = (address: string, pubKey: PublicKey) => {
    setWalletAddress(address)
    setPublicKey(pubKey)
    setIsConnected(true)
  }

  const handleDisconnect = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const phantom = (window as any).phantom?.solana || (window as any).solana
    if (phantom) {
      await phantom.disconnect()
    }
    setWalletAddress('')
    setPublicKey(null)
    setIsConnected(false)
    setPlayerProfile(null)
  }

  // 注册新玩家
  const handleRegister = async (username: string) => {
    if (!publicKey) return
    setIsLoading(true)
    try {
      await registerPlayer(publicKey, username)
      // 注册成功后重新获取 profile
      const profile = await getPlayerProfile(publicKey)
      setPlayerProfile(profile)
    } catch (error) {
      console.error('Registration failed:', error)
    }
    setIsLoading(false)
  }

  console.log('Player:', playerProfile?.username, 'Registered:', isRegistered)

  return (
    <>
      {!isConnected ? (
        <ConnectWallet onConnect={handleConnect} />
      ) : (
        <MainLayout
          walletAddress={walletAddress}
          onDisconnect={handleDisconnect}
          isRegistered={isRegistered}
          isLoading={isLoading}
          onRegister={handleRegister}
          playerProfile={playerProfile}
        />
      )}
    </>
  )
}

export default App
