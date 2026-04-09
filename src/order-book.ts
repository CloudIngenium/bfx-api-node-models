import CRC from 'crc-32'
import { EventEmitter } from 'node:events'
import { preparePrice } from './util/precision.js'

export class OrderBook extends EventEmitter {
  raw: boolean
  bids: number[][]
  asks: number[][]

  constructor (snap: number[][] | OrderBook = [], raw = false) {
    super()
    this.raw = raw

    if (snap instanceof OrderBook) {
      this.bids = snap.bids.slice()
      this.asks = snap.asks.slice()
    } else if (snap && Array.isArray(snap)) {
      this.bids = []
      this.asks = []
      this.updateFromSnapshot(snap)
    } else if (snap && Array.isArray((snap as { bids: number[][], asks: number[][] }).bids)) {
      const s = snap as { bids: number[][], asks: number[][] }
      this.bids = s.bids.slice()
      this.asks = s.asks.slice()
    } else {
      this.bids = []
      this.asks = []
    }
  }

  volBPSMid (bps: number): number {
    const priceI = this.raw
      ? (this.bids[0] || this.asks[0]).length === 4 ? 2 : 1
      : 0
    const mid = this.midPrice()
    const askLimit = mid * (1 + (bps / 10000))
    const bidLimit = mid * (1 - (bps / 10000))
    let askVol = 0
    let bidVol = 0

    for (const row of this.bids) {
      if (row[priceI] < bidLimit) break
      bidVol += row.length === 4 ? row[3] : row[2]
    }

    for (const row of this.asks) {
      if (row[priceI] > askLimit) break
      askVol += Math.abs(row.length === 4 ? row[3] : row[2])
    }

    return askVol + bidVol
  }

  checksum (): number {
    const { raw } = this
    const data: (string | number)[] = []

    for (let i = 0; i < 25; i++) {
      const bid = this.bids[i]
      const ask = this.asks[i]

      if (bid) {
        let price: string | number = bid[0]
        const amount = bid.length === 4 ? bid[3] : bid[2]
        if (!raw && typeof price !== 'string') {
          price = Number(preparePrice(price))
          price = /e/.test(price + '')
            ? (price as number).toFixed(Math.abs(+(price + '').split('e')[1]) + 1)
            : price
        }
        data.push(price, amount)
      }

      if (ask) {
        let price: string | number = ask[0]
        const amount = ask.length === 4 ? ask[3] : ask[2]
        if (!raw && typeof price !== 'string') {
          price = Number(preparePrice(price))
          price = /e/.test(price + '')
            ? (price as number).toFixed(Math.abs(+(price + '').split('e')[1]) + 1)
            : price
        }
        data.push(price, amount)
      }
    }

    return CRC.str(data.join(':'))
  }

  static checksumArr (arr: number[][], raw = false): number {
    let topAskI = -1

    for (let i = 0; i < arr.length; i++) {
      if ((arr[i].length === 4 ? Number(-arr[i][3]) : Number(arr[i][2])) < 0) {
        topAskI = i
        break
      }
    }

    const data: (string | number)[] = []

    for (let i = 0; i < 25; i++) {
      const bid = topAskI === -1 || i < topAskI ? arr[i] : null
      const ask = topAskI === -1 ? null : arr[topAskI + i]

      if (bid) {
        let price: string | number = bid[0]
        const amount = bid.length === 4 ? bid[3] : bid[2]
        if (!raw && typeof price !== 'string') {
          price = Number(preparePrice(price))
          price = /e/.test(price + '')
            ? (price as number).toFixed(Math.abs(+(price + '').split('e')[1]) + 1)
            : price
        }
        data.push(price, amount)
      }

      if (ask) {
        let price: string | number = ask[0]
        const amount = ask.length === 4 ? ask[3] : ask[2]
        if (!raw && typeof price !== 'string') {
          price = Number(preparePrice(price))
          price = /e/.test(price + '')
            ? (price as number).toFixed(Math.abs(+(price + '').split('e')[1]) + 1)
            : price
        }
        data.push(price, amount)
      }
    }

    return CRC.str(data.join(':'))
  }

  updateFromSnapshot (snapshot: number[][]): void {
    this.bids = []
    this.asks = []
    if (!snapshot || snapshot.length === 0) return

    for (const row of snapshot) {
      if (row.length === 4) {
        if (Number(row[3]) < 0) this.bids.push(row)
        else this.asks.push(row)
      } else {
        if (Number(row[2]) < 0) this.asks.push(row)
        else this.bids.push(row)
      }
    }
  }

  updateWith (entry: number[]): boolean {
    const { raw } = this
    const priceI = raw ? (entry.length === 4 ? 2 : 1) : 0
    const numEntry = entry.map(x => Number(x))
    if (!numEntry.every(Number.isFinite)) return false

    const count = raw ? -1 : numEntry.length === 4 ? numEntry[2] : numEntry[1]
    const price = numEntry[priceI]
    const oID = numEntry[0]
    const amount = numEntry.length === 4 ? numEntry[3] : numEntry[2]
    const dir = numEntry.length === 4
      ? amount < 0 ? 1 : -1
      : amount < 0 ? -1 : 1
    const side = numEntry.length === 4
      ? amount < 0 ? this.bids : this.asks
      : amount < 0 ? this.asks : this.bids

    if (side.length === 0 && (raw || count > 0)) {
      side.push(entry)
      this.emit('update', entry)
      return true
    }

    for (let i = 0; i < side.length; i++) {
      if ((!raw && Number(side[i][priceI]) === price) || (raw && Number(side[i][0]) === oID)) {
        if ((!raw && count === 0) || (raw && price === 0)) {
          side.splice(i, 1)
          this.emit('update', entry)
          return true
        } else if (!raw || (raw && price > 0)) {
          side.splice(i, 1)
          break
        }
      }
    }

    if ((raw && price === 0) || (!raw && count === 0)) return false

    let insertIndex = -1
    for (let i = 0; i < side.length; i++) {
      const pl = side[i].map(x => Number(x))
      if (insertIndex === -1 && (
        (dir === -1 && price < pl[priceI]) ||
        (dir === -1 && price === pl[priceI] && (raw && entry[0] < pl[0])) ||
        (dir === 1 && price > pl[priceI]) ||
        (dir === 1 && price === pl[priceI] && (raw && entry[0] < pl[0]))
      )) {
        insertIndex = i
        break
      }
    }

    if (insertIndex === -1) side.push(entry)
    else side.splice(insertIndex, 0, entry)

    this.emit('update', entry)
    return true
  }

  topBid (): number | null {
    const priceI = this.raw
      ? ((this.bids[0] || []).length === 4 || (this.asks[0] || []).length === 4) ? 2 : 1
      : 0
    return (this.topBidLevel() || [])[priceI] ?? null
  }

  topBidLevel (): number[] | null { return this.bids[0] || null }

  topAsk (): number | null {
    const priceI = this.raw
      ? ((this.bids[0] || []).length === 4 || (this.asks[0] || []).length === 4) ? 2 : 1
      : 0
    return (this.topAskLevel() || [])[priceI] ?? null
  }

  topAskLevel (): number[] | null { return this.asks[0] || null }

  midPrice (): number {
    const priceI = this.raw
      ? ((this.bids[0] || []).length === 4 || (this.asks[0] || []).length === 4) ? 2 : 1
      : 0
    const topAsk = (this.asks[0] || [])[priceI] || 0
    const topBid = (this.bids[0] || [])[priceI] || 0
    if (topAsk === 0) return topBid
    if (topBid === 0) return topAsk
    return (topAsk + topBid) / 2
  }

  spread (): number {
    const priceI = this.raw
      ? ((this.bids[0] || []).length === 4 || (this.asks[0] || []).length === 4) ? 2 : 1
      : 0
    const topAsk = (this.asks[0] || [])[priceI] || 0
    const topBid = (this.bids[0] || [])[priceI] || 0
    if (topAsk === 0 || topBid === 0) return 0
    return topAsk - topBid
  }

  bidAmount (): number {
    let amount = 0
    for (const bid of this.bids) amount += bid.length === 4 ? bid[3] : bid[2]
    return Math.abs(amount)
  }

  askAmount (): number {
    let amount = 0
    for (const ask of this.asks) amount += ask.length === 4 ? ask[3] : ask[2]
    return Math.abs(amount)
  }

  getEntry (price: number): Record<string, unknown> | null {
    const priceI = this.raw
      ? ((this.bids[0] || []).length === 4 || (this.asks[0] || []).length === 4) ? 2 : 1
      : 0
    const side = this.asks.length > 0
      ? price >= this.asks[0][priceI] ? this.asks : this.bids
      : price <= this.bids[0][priceI] ? this.bids : this.asks

    for (const row of side) {
      if (price === row[priceI]) return OrderBook.unserialize(row) as Record<string, unknown>
    }
    return null
  }

  serialize (): number[][] { return (this.asks || []).concat(this.bids || []) }

  toJS (): unknown {
    return OrderBook.unserialize(this.serialize(), this.raw)
  }

  static updateArrayOBWith (ob: number[][], entry: number[], raw = false): boolean {
    if (entry.length === 0) return false

    const priceI = raw ? (entry.length === 4 ? 2 : 1) : 0
    const price = Number(entry[priceI])
    const amount = entry.length === 4 ? Number(entry[3]) : Number(entry[2])
    const dir = entry.length === 4
      ? amount < 0 ? 1 : -1
      : amount < 0 ? -1 : 1
    const count = raw ? -1 : entry.length === 4 ? Number(entry[2]) : Number(entry[1])

    for (let i = 0; i < ob.length; i++) {
      const pl = ob[i].map(x => Number(x))
      if ((!raw && pl[priceI] === price) || (raw && pl[0] === Number(entry[0]))) {
        if ((!raw && count === 0) || (raw && price === 0)) {
          ob.splice(i, 1)
          return true
        } else {
          ob.splice(i, 1)
          break
        }
      }
    }

    if ((!raw && count === 0) || (raw && price === 0)) return false

    let insertIndex = -1
    for (let i = 0; i < ob.length; i++) {
      const pl = ob[i].map(x => Number(x))
      if (insertIndex === -1) {
        if (
          (dir === -1 && (pl.length === 4 ? -pl[3] : pl[2]) < 0 && price < pl[priceI]) ||
          (dir === -1 && (pl.length === 4 ? -pl[3] : pl[2]) < 0 && price === pl[priceI] && (raw && Number(entry[0]) < pl[0])) ||
          (dir === 1 && (pl.length === 4 ? -pl[3] : pl[2]) > 0 && price > pl[priceI]) ||
          (dir === 1 && (pl.length === 4 ? -pl[3] : pl[2]) > 0 && price === pl[priceI] && (raw && Number(entry[0]) < pl[0])) ||
          (dir === 1 && (pl.length === 4 ? -pl[3] : pl[2]) < 0)
        ) {
          insertIndex = i
          break
        }
      }
    }

    if (insertIndex === -1) ob.push(entry)
    else ob.splice(insertIndex, 0, entry)
    return true
  }

  static arrayOBMidPrice (ob: number[][] = [], raw = false): number | null {
    if (ob.length === 0) return null
    const priceI = raw ? (ob[0].length === 4 ? 2 : 1) : 0
    let bestBuy = -Infinity
    let bestAsk = Infinity

    for (const entry of ob) {
      if ((entry.length === 4 ? -entry[3] : entry[2]) > 0 && entry[priceI] > bestBuy) bestBuy = entry[priceI]
      if ((entry.length === 4 ? -entry[3] : entry[2]) < 0 && entry[priceI] < bestAsk) bestAsk = entry[priceI]
    }

    if (bestBuy === -Infinity || bestAsk === Infinity) return null
    return (bestAsk + bestBuy) / 2.0
  }

  static unserialize (arr: number[] | number[][], raw = false): Record<string, unknown> | { bids: Record<string, unknown>[], asks: Record<string, unknown>[] } {
    if (Array.isArray(arr[0])) {
      const entries = (arr as number[][]).map(e => OrderBook.unserialize(e, raw) as Record<string, unknown>)
      const bids = entries.filter(e => ((e.rate ? -(e.amount as number) : e.amount) as number) > 0)
      const asks = entries.filter(e => ((e.rate ? -(e.amount as number) : e.amount) as number) < 0)
      return { bids, asks }
    }

    const a = arr as number[]
    return a.length === 4
      ? raw
        ? { orderID: a[0], period: a[1], rate: a[2], amount: a[3] }
        : { rate: a[0], period: a[1], count: a[2], amount: a[3] }
      : raw
        ? { orderID: a[0], price: a[1], amount: a[2] }
        : { price: a[0], count: a[1], amount: a[2] }
  }
}
