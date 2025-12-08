import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UserProfile from './UserProfile'
import DrawerMenu from './DrawerMenu'
import Backpack from './Backpack'
import GachaPage from './GachaPage'
import Marketplace from './Marketplace'
import Pokedex from './Pokedex'
import Battle from './Battle'
import Leaderboard from './Leaderboard'
import TeamBuilder from './TeamBuilder'
import type { PlayerProfile as PlayerProfileType } from '../services/contract'
import '../css/MainLayout.css'

interface MainLayoutProps {
  walletAddress: string
  onDisconnect: () => void
  isRegistered: boolean
  isLoading: boolean
  onRegister: (username: string) => void
  playerProfile: PlayerProfileType | null
  onProfileUpdate: (profile: PlayerProfileType) => void
  currentRoute: string
}

type PageType = 'home' | 'backpack' | 'gacha' | 'marketplace' | 'pokedex' | 'battle' | 'leaderboard' | 'team'

function MainLayout({ walletAddress, onDisconnect, isRegistered, isLoading, onRegister, playerProfile, onProfileUpdate, currentRoute }: MainLayoutProps) {
  const navigate = useNavigate()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [username, setUsername] = useState('')

  const currentPage = currentRoute as PageType

  const handleNavigate = (page: PageType) => {
    navigate(`/${page === 'home' ? 'home' : page}`)
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'backpack':
        return <Backpack onBack={() => navigate('/home')} playerProfile={playerProfile} />
      case 'gacha':
        return <GachaPage onBack={() => navigate('/home')} playerProfile={playerProfile} onProfileUpdate={onProfileUpdate} />
      case 'marketplace':
        return <Marketplace onBack={() => navigate('/home')} />
      case 'pokedex':
        return <Pokedex onBack={() => navigate('/home')} />
      case 'battle':
        return <Battle onBack={() => navigate('/home')} playerProfile={playerProfile} />
      case 'leaderboard':
        return <Leaderboard onBack={() => navigate('/home')} />
      case 'team':
        return <TeamBuilder onBack={() => navigate('/home')} playerProfile={playerProfile} />
      default:
        return (
          <div className="home-screen">
            <h1 className="home-title">404 ZOO</h1>
            <p className="home-subtitle">欢迎回来，{playerProfile?.username || 'Player'}！</p>
          </div>
        )
    }
  }

  // 未注册时显示注册界面
  if (!isRegistered) {
    return (
      <div className="main-layout">
        <div className="main-content">
          <div className="register-screen">
            <h1 className="home-title">404 ZOO</h1>
            <p className="home-subtitle">创建你的玩家档案</p>
            {isLoading ? (
              <p className="loading-text">检查中...</p>
            ) : (
              <div className="register-form">
                <input
                  type="text"
                  placeholder="输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="username-input"
                  maxLength={32}
                />
                <button
                  className="register-btn"
                  onClick={() => onRegister(username)}
                  disabled={!username.trim() || isLoading}
                >
                  {isLoading ? '注册中...' : '开始冒险'}
                </button>
                <button className="disconnect-btn" onClick={onDisconnect}>
                  断开钱包
                </button>
              </div>
            )}
            <p className="wallet-info">钱包: {walletAddress}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="main-layout">
      <UserProfile 
        walletAddress={walletAddress} 
        onDisconnect={onDisconnect}
        username={playerProfile?.username || 'Player'}
        trophies={playerProfile?.trophies || 0}
        wins={playerProfile?.totalWins || 0}
      />
      
      <div className="main-content">
        {renderPage()}
      </div>

      <DrawerMenu 
        isOpen={isDrawerOpen}
        onToggle={() => setIsDrawerOpen(!isDrawerOpen)}
        onNavigate={handleNavigate}
        currentPage={currentPage}
      />
    </div>
  )
}

export default MainLayout
