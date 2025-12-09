import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
        return <Marketplace />
      case 'pokedex':
        return <Pokedex />
      case 'battle':
        return <Battle onBack={() => navigate('/home')} playerProfile={playerProfile} />
      case 'leaderboard':
        return <Leaderboard />
      case 'team':
        return <TeamBuilder onBack={() => navigate('/home')} playerProfile={playerProfile} />
      default:
        return (
          <div className="home-screen">
            <button className="battle-button" onClick={() => handleNavigate('battle')}>
              <img src="/battle-button.png" alt="BATTLE" className="battle-button-img" />
            </button>
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

  // 根据当前页面获取背景图片
  const getBackgroundImage = () => {
    switch (currentPage) {
      case 'marketplace':
        return '/market-bg.png'
      case 'team':
        return '/market-bg.png'
      case 'backpack':
        return '/market-bg.png'
      case 'gacha':
        return '/market-bg.png'
      case 'leaderboard':
        return '/market-bg.png'
      case 'pokedex':
        return '/market-bg.png'
      case 'battle':
        return '/market-bg.png'
      default:
        return '/background1.png'
    }
  }

  return (
    <div className="main-layout">
      <div className="main-layout-bg">
        <img src={getBackgroundImage()} alt="" className="background-image" />
      </div>
      
      {/* 顶部导航栏 */}
      <header className="top-nav">
        <div className="logo-section">
          <img src="/logo.png" alt="404 ZOO" className="logo-img" />
        </div>
        
        <nav className="nav-menu">
          <button 
            className={`nav-btn-img ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => handleNavigate('home')}
          >
            <img src="/nav-home.png" alt="HOME" />
          </button>
          <button 
            className={`nav-btn-img ${currentPage === 'marketplace' ? 'active' : ''}`}
            onClick={() => handleNavigate('marketplace')}
          >
            <img src="/nav-market.png" alt="MARKET" />
          </button>
          <button 
            className={`nav-btn-img ${currentPage === 'team' ? 'active' : ''}`}
            onClick={() => handleNavigate('team')}
          >
            <img src="/nav-team.png" alt="TEAM" />
          </button>
          <button 
            className={`nav-btn-img ${currentPage === 'backpack' ? 'active' : ''}`}
            onClick={() => handleNavigate('backpack')}
          >
            <img src="/nav-bag.png" alt="BAG" />
          </button>
          <button 
            className={`nav-btn-img ${currentPage === 'gacha' ? 'active' : ''}`}
            onClick={() => handleNavigate('gacha')}
          >
            <img src="/nav-gacha.png" alt="GACHA" />
          </button>
          <button 
            className={`nav-btn-img ${currentPage === 'leaderboard' ? 'active' : ''}`}
            onClick={() => handleNavigate('leaderboard')}
          >
            <img src="/nav-leaderboard.png" alt="LEADERBOARD" />
          </button>
          <button 
            className={`nav-btn-img ${currentPage === 'pokedex' ? 'active' : ''}`}
            onClick={() => handleNavigate('pokedex')}
          >
            <img src="/nav-collection.png" alt="COLLECTION" />
          </button>
        </nav>

        <div className="user-info-section">
          <div className="user-details">
            <div className="user-name">{playerProfile?.username || 'Player'}</div>
            <div className="user-wallet">{walletAddress}</div>
          </div>
          <button className="logout-btn" onClick={onDisconnect}>
            LOGOUT
          </button>
        </div>
      </header>
      
      <div className="main-content">
        {renderPage()}
      </div>
    </div>
  )
}

export default MainLayout
