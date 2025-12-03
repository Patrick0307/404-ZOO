import { useState } from 'react'
import '../css/UserProfile.css'

interface UserProfileProps {
  walletAddress: string
  onDisconnect: () => void
}

function UserProfile({ walletAddress, onDisconnect }: UserProfileProps) {
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
          <span className="username">Player_404</span>
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
              <span className="username">Player_404</span>
              <span className="wallet-full">{walletAddress}</span>
            </div>
          </div>
          <div className="dropdown-stats">
            <div className="stat-item">
              <span className="stat-value">12</span>
              <span className="stat-label">收藏</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">5</span>
              <span className="stat-label">胜场</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">1.5</span>
              <span className="stat-label">SOL</span>
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
