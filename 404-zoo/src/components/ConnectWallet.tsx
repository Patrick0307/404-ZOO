import '../css/ConnectWallet.css'

interface ConnectWalletProps {
  onConnect: (address: string) => void
}

function ConnectWallet({ onConnect }: ConnectWalletProps) {
  const handleConnect = async () => {
    // 模拟连接钱包，实际需要集成 Phantom
    const mockAddress = '7xKX...3nPq'
    onConnect(mockAddress)
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
        <button className="connect-btn" onClick={handleConnect}>
          <img 
            src="https://phantom.app/img/phantom-icon-purple.svg" 
            alt="Phantom" 
            className="phantom-icon"
          />
          连接 Phantom 钱包
        </button>
        <p className="network-info">Solana Network</p>
      </div>
    </div>
  )
}

export default ConnectWallet
