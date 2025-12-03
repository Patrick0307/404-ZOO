import '../css/GachaPage.css'

interface GachaPageProps {
  onBack: () => void
}

function GachaPage({ onBack }: GachaPageProps) {
  return (
    <div className="page-container">
      <div className="page-header">
        <span className="icon">🎴</span>
        <h2>抽卡</h2>
        <button className="back-btn" onClick={onBack}>返回</button>
      </div>

      <div className="gacha-content">
        <div className="gacha-banner">
          <span className="banner-featured">🐉</span>
          <span className="banner-title">神龙降临</span>
          <span className="banner-subtitle">限定卡池 · SSR概率UP</span>
        </div>

        <div className="gacha-rates">
          <div className="rate-item">
            <span className="rate-badge ssr">SSR</span>
            <span className="rate-value">3%</span>
          </div>
          <div className="rate-item">
            <span className="rate-badge sr">SR</span>
            <span className="rate-value">15%</span>
          </div>
          <div className="rate-item">
            <span className="rate-badge r">R</span>
            <span className="rate-value">82%</span>
          </div>
        </div>

        <div className="gacha-buttons">
          <button className="gacha-btn single">
            <span className="btn-label">单抽</span>
            <span className="btn-cost">💎 0.1 SOL</span>
          </button>
          <button className="gacha-btn multi">
            <span className="btn-label">十连抽</span>
            <span className="btn-cost">💎 0.9 SOL</span>
          </button>
        </div>

        <div className="gacha-pity">
          <span className="pity-label">距离保底</span>
          <span className="pity-count">42 / 90</span>
        </div>
      </div>
    </div>
  )
}

export default GachaPage
