import { useState } from 'react'
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js'
import '../css/ConnectWallet.css'

interface ConnectWalletProps {
  onConnect: (address: string, publicKey: PublicKey) => void
}

// Phantom 钱包类型定义
interface PhantomProvider {
  isPhantom?: boolean
  publicKey?: PublicKey
  connect: () => Promise<{ publicKey: PublicKey }>
  disconnect: () => Promise<void>
  on: (event: string, callback: (args: unknown) => void) => void
}

declare global {
  interface Window {
    solana?: PhantomProvider
    phantom?: {
      solana?: PhantomProvider
    }
  }
}

// 获取 Phantom provider，确保是 Phantom 而不是其他钱包
const getPhantomProvider = (): PhantomProvider | null => {
  // 优先使用 window.phantom.solana（Phantom 专属）
  if (window.phantom?.solana?.isPhantom) {
    return window.phantom.solana
  }
  // 备用：检查 window.solana 是否是 Phantom
  if (window.solana?.isPhantom) {
    return window.solana
  }
  return null
}

function ConnectWallet({ onConnect }: ConnectWalletProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    setIsConnecting(true)
    setError(null)

    try {
      // 获取 Phantom provider（确保是 Phantom 而不是其他钱包）
      const phantom = getPhantomProvider()
      
      if (!phantom) {
        window.open('https://phantom.app/', '_blank')
        setError('请先安装 Phantom 钱包')
        setIsConnecting(false)
        return
      }

      // 连接到 Solana devnet
      const connection = new Connection(clusterApiUrl('devnet'), 'confirmed')
      console.log('Connected to Solana devnet:', connection.rpcEndpoint)

      // 请求连接 Phantom 钱包
      const response = await phantom.connect()
      const publicKey = response.publicKey
      
      // 缩短地址显示
      const address = publicKey.toBase58()
      const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`
      
      console.log('Wallet connected:', address)
      onConnect(shortAddress, publicKey)
      
    } catch (err) {
      console.error('Connection error:', err)
      setError('连接失败，请重试')
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <div className="connect-wallet-container">
      <div className="connect-wallet-bg"></div>
      <div className="connect-wallet-content">
        <div className="game-logo">
          <span className="logo-text">404</span>
          <span className="logo-sub">ZOO</span>
        </div>
        <h1 className="game-title">欢迎来到 404 Zoo</h1>
        <p className="game-desc">连接你的 Phantom 钱包开始冒险</p>
        
        <button 
          className="connect-btn" 
          onClick={handleConnect}
          disabled={isConnecting}
        >
          <img 
            src="https://phantom.app/img/phantom-icon-purple.svg" 
            alt="Phantom" 
            className="phantom-icon"
          />
          {isConnecting ? '连接中...' : '连接 Phantom 钱包'}
        </button>
        
        {error && <p className="error-msg">{error}</p>}
        
        <p className="network-info">🟢 Solana Devnet</p>
      </div>
    </div>
  )
}

export default ConnectWallet
