import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { PublicKey } from '@solana/web3.js'
import ConnectWallet from './components/ConnectWallet'
import MainLayout from './components/MainLayout'
import {
  getPlayerProfile,
  registerPlayer,
  type PlayerProfile,
} from './services/contract'
import { loadAndCacheCards } from './services/cardCache'
import './css/LoadingScreen.css'

// Phantom 类型
interface PhantomProvider {
  isPhantom?: boolean
  publicKey?: PublicKey
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>
  disconnect: () => Promise<void>
}

function getPhantomProvider(): PhantomProvider | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phantom = (window as any).phantom?.solana || (window as any).solana
  if (phantom?.isPhantom) return phantom
  return null
}

function AppContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null)
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isRegistered = playerProfile !== null

  // 启动时尝试自动重连 + 预加载卡片数据
  useEffect(() => {
    async function tryAutoConnect() {
      const phantom = getPhantomProvider()
      if (!phantom) {
        setIsLoading(false)
        return
      }

      try {
        // 尝试静默连接（只有之前授权过才会成功）
        const response = await phantom.connect({ onlyIfTrusted: true })
        const pubKey = response.publicKey
        const address = pubKey.toBase58()
        const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`

        setPublicKey(pubKey)
        setWalletAddress(shortAddress)
        setIsConnected(true)

        // 加载玩家数据
        const profile = await getPlayerProfile(pubKey)
        setPlayerProfile(profile)
        console.log('Auto-connected:', address, 'Profile:', profile)

        // 只有在根路径时才导航到主页，否则保持当前路径
        if (location.pathname === '/') {
          navigate('/home')
        }
      } catch {
        // 用户之前没有授权，需要手动连接
        console.log('No previous connection, need manual connect')
      }
      setIsLoading(false)
    }

    // 启动时立即开始预加载卡片数据和图片
    loadAndCacheCards().catch(console.error)

    tryAutoConnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 手动连接后加载玩家数据
  useEffect(() => {
    async function loadPlayerProfile() {
      if (publicKey && isConnected && !isLoading) {
        const profile = await getPlayerProfile(publicKey)
        setPlayerProfile(profile)
        console.log('Player profile:', profile)
      }
    }
    loadPlayerProfile()
  }, [publicKey, isConnected, isLoading])

  const handleConnect = (address: string, pubKey: PublicKey) => {
    setWalletAddress(address)
    setPublicKey(pubKey)
    setIsConnected(true)
    navigate('/home')
  }

  const handleDisconnect = async () => {
    const phantom = getPhantomProvider()
    if (phantom) {
      await phantom.disconnect()
    }
    setWalletAddress('')
    setPublicKey(null)
    setIsConnected(false)
    setPlayerProfile(null)
    navigate('/')
  }

  const handleRegister = async (username: string) => {
    if (!publicKey) return
    setIsLoading(true)
    try {
      await registerPlayer(publicKey, username)
      const profile = await getPlayerProfile(publicKey)
      setPlayerProfile(profile)
    } catch (error) {
      console.error('Registration failed:', error)
    }
    setIsLoading(false)
  }

  const handleProfileUpdate = (profile: PlayerProfile) => {
    setPlayerProfile(profile)
  }

  // 初始加载中
  if (isLoading) {
    return (
      <div className="loading-screen-cyber">
        <div className="loading-bg">
          <img src="/background1.png" alt="" className="loading-background-image" />
        </div>
        <div className="loading-content-cyber">
          <h1 className="loading-title">404 ZOO</h1>
          <p className="loading-subtitle">SYSTEM_INITIALIZING...</p>
          <div className="loading-spinner-cyber">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
          <p className="loading-text-cyber">CONNECTING_TO_BLOCKCHAIN...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          isConnected ? (
            <Navigate to="/home" replace />
          ) : (
            <ConnectWallet onConnect={handleConnect} />
          )
        }
      />
      <Route
        path="/home"
        element={
          !isConnected ? (
            <Navigate to="/" replace />
          ) : (
            <MainLayout
              walletAddress={walletAddress}
              onDisconnect={handleDisconnect}
              isRegistered={isRegistered}
              isLoading={isLoading}
              onRegister={handleRegister}
              playerProfile={playerProfile}
              onProfileUpdate={handleProfileUpdate}
              currentRoute="home"
            />
          )
        }
      />
      <Route
        path="/backpack"
        element={
          !isConnected ? <Navigate to="/" replace /> : (
            <MainLayout
              walletAddress={walletAddress}
              onDisconnect={handleDisconnect}
              isRegistered={isRegistered}
              isLoading={isLoading}
              onRegister={handleRegister}
              playerProfile={playerProfile}
              onProfileUpdate={handleProfileUpdate}
              currentRoute="backpack"
            />
          )
        }
      />
      <Route
        path="/gacha"
        element={
          !isConnected ? <Navigate to="/" replace /> : (
            <MainLayout
              walletAddress={walletAddress}
              onDisconnect={handleDisconnect}
              isRegistered={isRegistered}
              isLoading={isLoading}
              onRegister={handleRegister}
              playerProfile={playerProfile}
              onProfileUpdate={handleProfileUpdate}
              currentRoute="gacha"
            />
          )
        }
      />
      <Route
        path="/marketplace"
        element={
          !isConnected ? <Navigate to="/" replace /> : (
            <MainLayout
              walletAddress={walletAddress}
              onDisconnect={handleDisconnect}
              isRegistered={isRegistered}
              isLoading={isLoading}
              onRegister={handleRegister}
              playerProfile={playerProfile}
              onProfileUpdate={handleProfileUpdate}
              currentRoute="marketplace"
            />
          )
        }
      />
      <Route
        path="/pokedex"
        element={
          !isConnected ? <Navigate to="/" replace /> : (
            <MainLayout
              walletAddress={walletAddress}
              onDisconnect={handleDisconnect}
              isRegistered={isRegistered}
              isLoading={isLoading}
              onRegister={handleRegister}
              playerProfile={playerProfile}
              onProfileUpdate={handleProfileUpdate}
              currentRoute="pokedex"
            />
          )
        }
      />
      <Route
        path="/battle"
        element={
          !isConnected ? <Navigate to="/" replace /> : (
            <MainLayout
              walletAddress={walletAddress}
              onDisconnect={handleDisconnect}
              isRegistered={isRegistered}
              isLoading={isLoading}
              onRegister={handleRegister}
              playerProfile={playerProfile}
              onProfileUpdate={handleProfileUpdate}
              currentRoute="battle"
            />
          )
        }
      />
      <Route
        path="/leaderboard"
        element={
          !isConnected ? <Navigate to="/" replace /> : (
            <MainLayout
              walletAddress={walletAddress}
              onDisconnect={handleDisconnect}
              isRegistered={isRegistered}
              isLoading={isLoading}
              onRegister={handleRegister}
              playerProfile={playerProfile}
              onProfileUpdate={handleProfileUpdate}
              currentRoute="leaderboard"
            />
          )
        }
      />
      <Route
        path="/team"
        element={
          !isConnected ? <Navigate to="/" replace /> : (
            <MainLayout
              walletAddress={walletAddress}
              onDisconnect={handleDisconnect}
              isRegistered={isRegistered}
              isLoading={isLoading}
              onRegister={handleRegister}
              playerProfile={playerProfile}
              onProfileUpdate={handleProfileUpdate}
              currentRoute="team"
            />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
