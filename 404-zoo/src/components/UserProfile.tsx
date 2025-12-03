import { useState } from 'react'
import '../css/UserProfile.css'

interface UserProfileProps {
  walletAddress: string
  onDisconnect: () => void
  username: string
  trophies: number
  wins: number
}

function UserProfile({ walletAddress, onDisconnect, username, trophies, wins }: UserProfileProps) {
  const [showDropdown, setShowDropdown] = useState(false)

  return (
    <div className="user-profile">
      <div 
        className="profile-trigger"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <div className="avatar">
          <span>🦊</span>
        </div>
        <div className="user-info">
          <span className="username">{username}</span>
          <span className="wallet-address">{walletAddress}</span>
        </div>
      </div>

      {showDropdown && (
        <div className="profile-dropdown">
          <div className="dropdown-header">
            <div className="avatar large">
              <span>🦊</span>
            </div>
            <div className="dropdown-user-info">
              <span className="username">{username}</span>
              <span className="wallet-full">{walletAddress}</span>
            </div>
          </div>
          <div className="dropdown-stats">
            <div className="stat-item">
              <span className="stat-value">🏆 {trophies}</span>
              <span className="stat-label">奖杯</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{wins}</span>
              <span className="stat-label">胜场</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">0</span>
              <span className="stat-label">卡片</span>
            </div>
          </div>
          <div className="dropdown-actions">
            <button className="dropdown-btn">
              <span>⚙️</span> 设置
            </button>
            <button className="dropdown-btn disconnect" onClick={onDisconnect}>
              <span>🚪</span> 断开连接
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserProfile
