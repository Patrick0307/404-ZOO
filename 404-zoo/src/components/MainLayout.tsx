import { useState } from 'react'
import UserProfile from './UserProfile'
import DrawerMenu from './DrawerMenu'
import Backpack from './Backpack'
import GachaPage from './GachaPage'
import Marketplace from './Marketplace'
import Pokedex from './Pokedex'
import Battle from './Battle'
import Leaderboard from './Leaderboard'
import '../css/MainLayout.css'

interface MainLayoutProps {
  walletAddress: string
  onDisconnect: () => void
}

type PageType = 'home' | 'backpack' | 'gacha' | 'marketplace' | 'pokedex' | 'battle' | 'leaderboard' | 'team'

// 模拟已选择的阵容数据
const selectedTeam = [
  { id: 1, name: '火焰龙', emoji: '🐉' },
  { id: 2, name: '雷电鸟', emoji: '⚡' },
  { id: 3, name: '水晶龟', emoji: '🐢' },
  null, null, null, null, null, null, null
]

function MainLayout({ walletAddress, onDisconnect }: MainLayoutProps) {
  const [currentPage, setCurrentPage] = useState<PageType>('home')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const handleNavigate = (page: PageType) => {
    setCurrentPage(page)
    setIsDrawerOpen(false)
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'backpack':
        return <Backpack onBack={() => setCurrentPage('home')} />
      case 'gacha':
        return <GachaPage onBack={() => setCurrentPage('home')} />
      case 'marketplace':
        return <Marketplace onBack={() => setCurrentPage('home')} />
      case 'pokedex':
        return <Pokedex onBack={() => setCurrentPage('home')} />
      case 'battle':
        return <Battle onBack={() => setCurrentPage('home')} />
      case 'leaderboard':
        return <Leaderboard onBack={() => setCurrentPage('home')} />
      case 'team':
        return (
          <div className="page-container">
            <div className="page-header">
              <span className="icon">👥</span>
              <h2>组队</h2>
              <button className="back-btn" onClick={() => setCurrentPage('home')}>返回</button>
            </div>
            <p className="team-hint">从背包中选择卡片加入阵容</p>
            <div className="team-builder">
              <div className="team-slots">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div key={index} className="team-slot">
                    <div className="slot-number">{index + 1}</div>
                    {selectedTeam[index] ? (
                      <div className="slot-card">
                        <span className="card-emoji">{selectedTeam[index]?.emoji}</span>
                        <span className="card-name">{selectedTeam[index]?.name}</span>
                      </div>
                    ) : (
                      <div className="slot-empty">
                        <span>+</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="available-cards">
                <h3>可用卡片</h3>
                <div className="cards-grid">
                  {['🦁', '🐯', '🐻', '🐼', '🦊', '🐰'].map((emoji, i) => (
                    <div key={i} className="available-card">
                      <span>{emoji}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      default:
        return (
          <div className="home-screen">
            <h1 className="home-title">404 ZOO</h1>
            <p className="home-subtitle">我的出战阵容</p>
            <div className="card-slots">
              {selectedTeam.map((card, index) => (
                <div key={index} className={`card-slot ${card ? 'filled' : ''}`}>
                  <div className="slot-number">{index + 1}</div>
                  {card ? (
                    <div className="slot-card-display">
                      <span className="card-emoji">{card.emoji}</span>
                    </div>
                  ) : (
                    <div className="slot-placeholder">
                      <span>-</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
    }
  }

  return (
    <div className="main-layout">
      <UserProfile 
        walletAddress={walletAddress} 
        onDisconnect={onDisconnect} 
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
