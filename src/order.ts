import { prepareAmount, preparePrice } from './util/precision.js'

import { numberValidator } from './validators/number.js'
import { dateValidator } from './validators/date.js'
import { amountValidator } from './validators/amount.js'
import { stringValidator } from './validators/string.js'
import { boolValidator } from './validators/bool.js'
import { priceValidator } from './validators/price.js'
import { symbolValidator } from './validators/symbol.js'
import { nullable } from './validators/nullable.js'
import { Model } from './model.js'

const statuses = ['ACTIVE', 'EXECUTED', 'PARTIALLY FILLED', 'CANCELED']
const types = [
  'MARKET', 'EXCHANGE MARKET', 'LIMIT', 'EXCHANGE LIMIT', 'STOP',
  'EXCHANGE STOP', 'TRAILING STOP', 'EXCHANGE TRAILING STOP', 'FOK',
  'EXCHANGE FOK', 'STOP LIMIT', 'EXCHANGE STOP LIMIT', 'IOC', 'EXCHANGE IOC'
]

const boolFields = ['notify']
const fields = {
  id: 0,
  gid: 1,
  cid: 2,
  symbol: 3,
  mtsCreate: 4,
  mtsUpdate: 5,
  amount: 6,
  amountOrig: 7,
  type: 8,
  typePrev: 9,
  mtsTIF: 10,
  flags: 12,
  status: 13,
  price: 16,
  priceAvg: 17,
  priceTrailing: 18,
  priceAuxLimit: 19,
  notify: 23,
  hidden: 24,
  placedId: 25,
  routing: 28,
  meta: 31
}

let lastCID = Date.now()

interface ApiInterface {
  updateOrder? (changes: Record<string, unknown>): Promise<unknown>
  submitOrder? (params: { order: Order }): Promise<unknown[]>
  cancelOrder? (params: { id: number }): Promise<unknown>
  onOrderNew? (data: Record<string, unknown>, cb: (order: unknown) => void): void
  onOrderUpdate? (data: Record<string, unknown>, cb: (order: unknown) => void): void
  onOrderClose? (data: Record<string, unknown>, cb: (order: unknown) => void): void
  removeListeners? (cbGID: string): void
  constructor: { name: string }
}

export class Order extends Model {
  id!: number
  gid!: number
  cid!: number
  symbol!: string
  mtsCreate!: number
  mtsUpdate!: number
  amount!: number
  amountOrig!: number
  type!: string
  typePrev!: string
  mtsTIF!: number
  flags!: number
  status!: string
  price!: number
  priceAvg!: number
  priceTrailing!: number
  priceAuxLimit!: number
  notify!: boolean
  hidden!: number
  placedId!: number
  routing!: string
  meta!: Record<string, unknown>
  lev!: number
  affiliateCode!: string
  tif!: string
  cidOCO!: number
  _apiInterface?: ApiInterface
  _lastAmount!: number

  constructor (data: unknown = {}, apiInterface?: ApiInterface) {
    super({ data, fields, boolFields })

    if (!this.flags) this.flags = 0
    const d = data as Record<string, unknown>
    if (d.hidden !== undefined) this.setHidden(d.hidden as boolean)
    if (d.visibleOnHit !== undefined) this.setVisibleOnHit(d.visibleOnHit as boolean)
    if (d.postonly !== undefined) this.setPostOnly(d.postonly as boolean)
    if (d.reduceonly !== undefined) this.setReduceOnly(d.reduceonly as boolean)
    if (d.oco !== undefined) {
      this.setOCO(d.oco as boolean, d.priceAuxLimit as number, d.cidOCO as number)
    }

    this.lev = d.lev as number
    this.affiliateCode = d.affiliateCode as string
    this._apiInterface = apiInterface

    this._onWSOrderNew = this._onWSOrderNew.bind(this)
    this._onWSOrderUpdate = this._onWSOrderUpdate.bind(this)
    this._onWSOrderClose = this._onWSOrderClose.bind(this)

    if (isNaN(this.amountOrig) && !isNaN(this.amount)) {
      this.amountOrig = this.amount
    }

    this._lastAmount = this.amount
  }

  static unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[] {
    return super.unserialize({ data, fields, boolFields })
  }

  toString (): string {
    const {
      type = '', symbol = '', amount, price, affiliateCode, priceAuxLimit,
      amountOrig, status, id, cid
    } = this

    const market = `${symbol.substring(1, 4)}/${symbol.substring(4)}`

    return [
      id && `(id: ${id})`,
      cid && `(cid: ${cid})`,
      type.toUpperCase(),
      'order on',
      market,
      status && `(${status})`,
      'for',
      prepareAmount(amount),
      (amountOrig !== amount) && `(${prepareAmount(amountOrig)})`,
      '@',
      /market/.test(type.toLowerCase()) ? 'MARKET' : preparePrice(price),
      this.isHidden() && 'hidden',
      this.isVisibleOnHit() && 'visible-on-hit',
      this.isPostOnly() && 'post-only',
      this.isReduceOnly() && 'reduce-only',
      this.isPositionClose() && 'pos-close',
      this.isOCO() && 'OCO',
      this.isOCO() && `(stop: ${priceAuxLimit})`,
      !this.includesVariableRates() && 'No VRR',
      affiliateCode && `[aff-code: ${affiliateCode}]`
    ].flat().filter(Boolean).join(' ')
  }

  isOCO (): boolean { return !!(this.flags & Order.flags.OCO) }
  isHidden (): boolean { return !!(this.flags & Order.flags.HIDDEN) }
  isVisibleOnHit (): boolean { return !!(this.isHidden() && this.meta && this.meta.make_visible) }
  isPostOnly (): boolean { return !!(this.flags & Order.flags.POSTONLY) }
  includesVariableRates (): boolean { return !(this.flags & Order.flags.NO_VR) }
  isPositionClose (): boolean { return !!(this.flags & Order.flags.POS_CLOSE) }
  isReduceOnly (): boolean { return !!(this.flags & Order.flags.REDUCE_ONLY) }

  setOCO (v: boolean, stopPrice = this.priceAuxLimit, cidOCO = this.cidOCO): number | undefined {
    if (v) {
      this.priceAuxLimit = stopPrice
      this.cidOCO = cidOCO
    }
    return this.modifyFlag(Order.flags.OCO, v)
  }

  setHidden (v: boolean): number | undefined {
    if (!v && this.meta) {
      delete this.meta.make_visible
    }
    return this.modifyFlag(Order.flags.HIDDEN, v)
  }

  setVisibleOnHit (v: boolean): Record<string, unknown> | undefined {
    if (!this.isHidden() || typeof v !== 'boolean') return
    this.meta = { ...(this.meta || {}), make_visible: +v }
    return this.meta
  }

  setPostOnly (v: boolean): number | undefined { return this.modifyFlag(Order.flags.POSTONLY, v) }
  setNoVariableRates (v: boolean): number | undefined { return this.modifyFlag(Order.flags.NO_VR, v) }
  setPositionClose (v: boolean): number | undefined { return this.modifyFlag(Order.flags.POS_CLOSE, v) }
  setReduceOnly (v: boolean): number | undefined { return this.modifyFlag(Order.flags.REDUCE_ONLY, v) }

  modifyFlag (flag: number, active: boolean): number | undefined {
    if (!!(this.flags & flag) === active) return
    this.flags += active ? flag : -flag
    return this.flags
  }

  async update (changes: Record<string, unknown> = {}, apiInterface = this._apiInterface): Promise<unknown> {
    if (!apiInterface) throw new Error('no ws client available')

    const keys = Object.keys(changes)
    const fieldKeys = Object.keys(this._fields)

    // A `for...of` loop, NOT `keys.forEach`: the delta guard below aborts the
    // update, and a callback cannot. Until 2026-09-27 it read
    // `return Promise.reject(...)` inside a forEach callback, whose return value
    // is discarded — so applying a delta to an order with no amount resolved
    // normally, forwarded the bad delta to the exchange anyway, and leaked an
    // unhandled rejection that terminates Node by default. Measured: update()
    // returned 'ok' while updateOrder() received `delta: "5.00000000"`.
    for (const k of keys) {
      if (k === 'id') continue
      if (fieldKeys.includes(k)) {
        (this as Record<string, unknown>)[k] = changes[k]
      } else if (k === 'price_trailing') {
        this.priceTrailing = Number(changes[k])
      } else if (k === 'price_oco_stop' || k === 'price_aux_limit') {
        this.priceAuxLimit = Number(changes[k])
      } else if (k === 'delta' && !Number.isNaN(+(changes[k] as number))) {
        if (Number.isNaN(+this.amount)) {
          throw new Error("can't apply delta to missing amount")
        }
        this.amount += Number(changes[k])
        this._lastAmount = this.amount
      }
    }

    changes.id = this.id
    if (changes.price) changes.price = preparePrice(changes.price as number)
    if (changes.amount) changes.amount = prepareAmount(changes.amount as number)
    if (changes.delta) changes.delta = prepareAmount(changes.delta as number)
    if (changes.price_aux_limit) changes.price_aux_limit = preparePrice(changes.price_aux_limit as number)
    if (changes.price_trailing) changes.price_trailing = preparePrice(changes.price_trailing as number)

    return apiInterface!.updateOrder!(changes)
  }

  toPreview (): Record<string, unknown> {
    const prev: Record<string, unknown> = {
      gid: this.gid, cid: this.cid, symbol: this.symbol,
      amount: this.amount, type: this.type, price: this.price,
      notify: this.notify, flags: this.flags
    }
    if (!Number.isNaN(+this.lev)) prev.lev = +this.lev
    return prev
  }

  registerListeners (apiInterface = this._apiInterface): void {
    if (!apiInterface || apiInterface.constructor.name !== 'WSv2') return
    const chanData: Record<string, unknown> = { symbol: this.symbol, cbGID: this.cbGID() }
    if (Number.isFinite(+this.id)) chanData.id = +this.id
    if (Number.isFinite(+this.gid)) chanData.gid = +this.gid
    if (Number.isFinite(+this.cid)) chanData.cid = +this.cid
    apiInterface.onOrderNew!(chanData, this._onWSOrderNew)
    apiInterface.onOrderUpdate!(chanData, this._onWSOrderUpdate)
    apiInterface.onOrderClose!(chanData, this._onWSOrderClose)
    this._apiInterface = apiInterface
  }

  removeListeners (apiInterface = this._apiInterface): void {
    if (apiInterface) apiInterface.removeListeners!(this.cbGID())
  }

  cbGID (): string { return `${this.gid}.${this.cid}` }

  async submit (apiInterface = this._apiInterface): Promise<this> {
    if (!apiInterface) throw new Error('no API interface provided')
    const orderArr = await apiInterface.submitOrder!({ order: this })
    Object.assign(this, Order.unserialize(orderArr as unknown))
    return this
  }

  async cancel (apiInterface = this._apiInterface): Promise<unknown> {
    if (!apiInterface) throw new Error('no API interface provided')
    if (!this.id) throw new Error('order has no ID')
    return apiInterface.cancelOrder!({ id: this.id })
  }

  async recreate (apiInterface = this._apiInterface): Promise<this> {
    if (!apiInterface) throw new Error('no API interface provided')
    if (!this.id) throw new Error('order has no ID')
    await this.cancel(apiInterface)
    this.id = null as unknown as number
    return this.submit(apiInterface)
  }

  updateFrom (order: Partial<Order> = {} as Order): void {
    const { id, gid, cid } = order
    if (
      ((this.id && (+id! !== +this.id)) && (this.cid && (+cid! !== +this.cid))) ||
      (this.gid && (+gid! !== +this.gid))
    ) {
      throw new Error('order IDs do not match, cannot update from order')
    }
    this.id = order.id!
    this.amount = order.amount!
    this.status = order.status!
    this.mtsUpdate = order.mtsUpdate!
    this.priceAvg = order.priceAvg!
  }

  getLastFillAmount (): number { return this._lastAmount - this.amount }
  resetFilledAmount (): void { this._lastAmount = this.amount }
  getBaseCurrency (): string { return this.symbol.substring(1, 4) }
  getQuoteCurrency (): string { return this.symbol.substring(4) }
  getNotionalValue (): number { return Math.abs(this.amount * this.price) }

  isPartiallyFilled (): boolean {
    const a = Math.abs(this.amount)
    return a > 0 && a < Math.abs(this.amountOrig)
  }

  private _onWSOrderUpdate (order: unknown): void {
    Object.assign(this, Order.unserialize(order))
    this.emit('update', order, this)
  }

  private _onWSOrderClose (order: unknown): void {
    Object.assign(this, Order.unserialize(order))
    this.emit('update', order, this)
    this.emit('close', order, this)
  }

  private _onWSOrderNew (order: unknown): void {
    Object.assign(this, Order.unserialize(order))
    this.emit('update', order, this)
    this.emit('new', order, this)
  }

  toNewOrderPacket (): Record<string, unknown> {
    const meta = { ...(this.meta || {}) }

    if (typeof this.affiliateCode === 'string' && this.affiliateCode.length > 0) {
      (meta as Record<string, unknown>).aff_code = this.affiliateCode
    }

    const data: Record<string, unknown> = {
      gid: this.gid,
      cid: Number.isFinite(+this.cid) ? +this.cid : lastCID++,
      symbol: this.symbol,
      type: this.type,
      amount: prepareAmount(+this.amount),
      flags: this.flags || 0,
      meta,
      tif: this.tif
    }

    if (!Number.isNaN(+this.price)) data.price = preparePrice(+this.price)
    if (!Number.isNaN(+this.lev)) data.lev = +this.lev
    if (this.priceTrailing !== null && !Number.isNaN(+this.priceTrailing)) {
      data.price_trailing = preparePrice(+this.priceTrailing)
    }
    if (this.priceAuxLimit !== null && !Number.isNaN(+this.priceAuxLimit)) {
      if (this.flags & Order.flags.OCO) {
        data.price_oco_stop = preparePrice(+this.priceAuxLimit)
        data.cid_oco = this.cidOCO
      } else {
        data.price_aux_limit = preparePrice(+this.priceAuxLimit)
      }
    }

    return data
  }

  static getBaseCurrency (arr: unknown[] = []): string {
    return ((arr[3] as string) || '').substring(1, 4).toUpperCase()
  }

  static getQuoteCurrency (arr: unknown[] = []): string {
    return ((arr[3] as string) || '').substring(4).toUpperCase()
  }

  static validate (data: unknown): Error | null {
    return super.validate({
      // `boolFields` matters here exactly as it does in unserialize(): without
      // it, `notify` is validated as the raw 0/1 off the wire and every real
      // row fails. Order was the one model that declared boolFields and then
      // did not hand them to its own validator.
      data, fields, boolFields,
      validators: {
        symbol: symbolValidator,
        id: numberValidator,
        // Five fields carry `null` on a perfectly ordinary order, so they are
        // nullable rather than required (see validators/nullable.ts). Until
        // 2026-09-27 they used the bare validators inherited from upstream,
        // which made validate() reject the COMMON shape: `gid` is null unless
        // the order joined a group, `cid` unless this client placed it,
        // `typePrev` until something changes the type, `mtsTIF` unless a
        // time-in-force was set, and `placedId` unless another order placed
        // this one. Ungrouped orders are the overwhelming majority, so
        // `gid: null` alone failed nearly every real row -- the shape this
        // package's own sibling (bitfinex-api-node ws2-integration) uses to
        // model an order. Loosening only: nothing that validated before stops.
        gid: nullable(numberValidator),
        cid: nullable(dateValidator),
        typePrev: nullable((v: unknown) => stringValidator(v, Object.values(Order.type))),
        mtsTIF: nullable(dateValidator),
        mtsCreate: dateValidator, mtsUpdate: dateValidator,
        amount: amountValidator, amountOrig: amountValidator,
        type: (v: unknown) => stringValidator(v, Object.values(Order.type)),
        flags: numberValidator, status: stringValidator,
        price: priceValidator, priceAvg: priceValidator,
        priceTrailing: priceValidator, priceAuxLimit: priceValidator,
        notify: boolValidator,
        // `hidden` is declared `number` on this class and is NOT a boolField,
        // so nothing ever decodes it to a boolean -- the wire 0/1 arrives and
        // stays. Validating it as a bool contradicted its own declared type
        // and rejected every row that carried it.
        hidden: numberValidator,
        placedId: nullable(numberValidator)
      }
    })
  }

  static type: Record<string, string> = {}
  static status: Record<string, string> = {}
  static flags = {
    OCO: 2 ** 14,
    POSTONLY: 2 ** 12,
    HIDDEN: 2 ** 6,
    NO_VR: 2 ** 19,
    POS_CLOSE: 2 ** 9,
    REDUCE_ONLY: 2 ** 10
  }
}

for (const s of statuses) {
  Order.status[s] = s
  Order.status[s.split(' ').join('_')] = s
}

for (const t of types) {
  Order.type[t] = t
  Order.type[t.split(' ').join('_')] = t
}
