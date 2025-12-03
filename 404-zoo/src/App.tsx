import { useState } from 'react'
import ConnectWallet from './components/ConnectWallet'
import MainLayout from './components/MainLayout'

function App() {
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')

  const handleConnect = (address: string) => {
    setWalletAddress(address)
    setIsConnected(true)
  }

  const handleDisconnect = () => {
    setWalletAddress('')
    setIsConnected(false)
  }

  return (
    <>
      {!isConnected ? (
        <ConnectWallet onConnect={handleConnect} />
      ) : (
        <MainLayout 
          walletAddress={walletAddress} 
          onDisconnect={handleDisconnect} 
        />
      )}
    </>
  )
}

export default App
