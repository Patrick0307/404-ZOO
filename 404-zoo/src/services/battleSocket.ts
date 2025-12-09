/**
 * 战斗 WebSocket 服务
 * 用于实时对战匹配和同步
 */

// 服务器地址（开发环境）
const WS_SERVER_URL = import.meta.env.VITE_WS_SERVER || 'ws://localhost:8080'

export interface BattleMessage {
  type: string
  payload: unknown
}

export interface MatchFoundPayload {
  roomId: string
  opponent: {
    name: string
    rating: number
  }
}

export interface RoundStartPayload {
  round: number
  phase: 'preparation' | 'battle'
  timer: number
}

export interface BattleStartPayload {
  round: number
  myUnits: BattleUnitData[]
  opponentUnits: BattleUnitData[]
}

export interface BattleUnitData {
  id: string
  cardTypeId: number
  name: string
  attack: number
  health: number
  maxHealth: number
  star: number
  position: number | null
}

export type MessageHandler = (message: BattleMessage) => void

class BattleSocketService {
  private ws: WebSocket | null = null
  private messageHandlers: Set<MessageHandler> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 2000
  private socketId: string | null = null
  private shouldReconnect = false // 控制是否自动重连

  // 连接到战斗服务器
  connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      // 如果已经连接，直接返回
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.socketId) {
        console.log('🔌 Already connected, reusing connection')
        resolve(this.socketId)
        return
      }
      
      // 如果正在连接中，等待连接完成
      if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
        console.log('🔌 Connection in progress, waiting...')
        const checkConnection = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN && this.socketId) {
            clearInterval(checkConnection)
            resolve(this.socketId)
          } else if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
            clearInterval(checkConnection)
            // 重新尝试连接
            this.ws = null
            this.connect().then(resolve).catch(reject)
          }
        }, 100)
        return
      }
      
      // 关闭旧连接（只有 CLOSED 或 CLOSING 状态才关闭）
      if (this.ws && this.ws.readyState !== WebSocket.CONNECTING) {
        this.ws.onclose = null
        this.ws.close()
        this.ws = null
      }
      
      try {
        console.log(`🔌 Connecting to ${WS_SERVER_URL}...`)
        this.shouldReconnect = true
        this.ws = new WebSocket(WS_SERVER_URL)
        
        this.ws.onopen = () => {
          console.log('✅ Battle WebSocket connected')
          this.reconnectAttempts = 0
        }
        
        this.ws.onmessage = (event) => {
          try {
            const message: BattleMessage = JSON.parse(event.data)
            
            // 处理连接成功消息
            if (message.type === 'connected') {
              this.socketId = (message.payload as { odId: string }).odId
              console.log(`🆔 Socket ID: ${this.socketId}`)
              resolve(this.socketId)
            }
            
            // 分发给所有处理器
            this.messageHandlers.forEach(handler => handler(message))
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e)
          }
        }
        
        this.ws.onerror = (error) => {
          console.error('❌ Battle WebSocket error:', error)
          reject(error)
        }
        
        this.ws.onclose = () => {
          console.log('🔌 Battle WebSocket closed')
          this.socketId = null
          if (this.shouldReconnect) {
            this.attemptReconnect()
          }
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  // 断开连接
  disconnect() {
    this.shouldReconnect = false // 禁用自动重连
    this.reconnectAttempts = 0
    if (this.ws) {
      this.ws.onclose = null // 防止触发重连
      this.ws.close()
      this.ws = null
    }
    this.socketId = null
    this.messageHandlers.clear()
  }

  // 发送消息
  private send(type: string, payload: unknown = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }))
    } else {
      console.warn('⚠️ WebSocket not connected')
    }
  }

  // 设置玩家信息
  setProfile(name: string, rating: number) {
    this.send('set_profile', { name, rating })
  }

  // 开始匹配
  startMatching(deck: { deckId: string; cardMints: string[] }) {
    this.send('start_match', { deck })
  }

  // 取消匹配
  cancelMatching() {
    this.send('cancel_match')
  }

  // 发送玩家操作（备战阶段）
  sendAction(action: string, data: unknown) {
    this.send('player_action', { action, data })
  }

  // 购买卡牌
  buyCard(gold: number, bench: BattleUnitData[]) {
    this.sendAction('buy_card', { gold, bench })
  }

  // 放置单位
  placeUnit(units: BattleUnitData[], bench: BattleUnitData[]) {
    this.sendAction('place_unit', { units, bench })
  }

  // 移除单位
  removeUnit(units: BattleUnitData[], bench: BattleUnitData[]) {
    this.sendAction('remove_unit', { units, bench })
  }

  // 刷新商店
  refreshShop(gold: number) {
    this.sendAction('refresh_shop', { gold })
  }

  // 确认准备完成
  confirmReady() {
    this.send('ready')
  }

  // 同步状态
  syncState(state: {
    hp?: number
    gold?: number
    units?: BattleUnitData[]
    bench?: BattleUnitData[]
  }) {
    this.send('sync_state', state)
  }

  // 发送战斗结束
  sendBattleEnd(result: 'win' | 'lose' | 'draw' | null, hp: number) {
    this.send('battle_end', { result, hp })
  }

  // 添加消息处理器
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  // 尝试重连
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Max reconnect attempts reached')
      return
    }
    
    this.reconnectAttempts++
    console.log(`🔄 Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
    
    setTimeout(() => {
      this.connect().catch(() => {
        // 重连失败，会触发 onclose 再次尝试
      })
    }, this.reconnectDelay * this.reconnectAttempts)
  }

  // 检查连接状态
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  // 获取 Socket ID
  getSocketId(): string | null {
    return this.socketId
  }
}

// 导出单例
export const battleSocket = new BattleSocketService()
