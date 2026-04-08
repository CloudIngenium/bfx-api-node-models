import { prepareAmount, preparePrice } from 'bfx-api-node-util'

import { numberValidator } from './validators/number.js'
import { symbolValidator } from './validators/symbol.js'
import { stringValidator } from './validators/string.js'
import { amountValidator } from './validators/amount.js'
import { priceValidator } from './validators/price.js'
import { dateValidator } from './validators/date.js'
import { Model } from './model.js'
import { Order } from './order.js'

const statuses = ['ACTIVE', 'CLOSED']
const fields = {
  symbol: 0, status: 1, amount: 2, basePrice: 3, marginFunding: 4,
  marginFundingType: 5, pl: 6, plPerc: 7, liquidationPrice: 8, leverage: 9,
  id: 11, mtsCreate: 12, mtsUpdate: 13, type: 15, collateral: 17,
  collateralMin: 18, meta: 19
}

interface PositionApiInterface {
  claimPosition? (params: { id: number }): Promise<unknown[]>
  closePosition? (params: { position_id: number }): Promise<unknown>
}

export class Position extends Model {
  id!: number
  symbol!: string
  status!: string
  amount!: number
  basePrice!: number
  marginFunding!: number
  marginFundingType!: string
  pl!: number
  plPerc!: number
  liquidationPrice!: number
  leverage!: number
  mtsCreate!: number
  mtsUpdate!: number
  type!: string
  collateral!: number
  collateralMin!: number
  meta!: Record<string, unknown>
  price!: number
  _apiInterface?: PositionApiInterface

  constructor (data: unknown = {}, apiInterface?: PositionApiInterface) {
    super({ data, fields })
    this._apiInterface = apiInterface
  }

  static unserialize (data: unknown): Record<string, unknown> | Record<string, unknown>[] {
    return super.unserialize({ data, fields })
  }

  async claim (apiInterface = this._apiInterface): Promise<this> {
    if (!apiInterface?.claimPosition) throw new Error('claim position only supported on RESTv2')
    const positionArray = await apiInterface.claimPosition({ id: this.id })
    Object.assign(this, Position.unserialize(positionArray))
    return this
  }

  async close (apiInterface = this._apiInterface): Promise<unknown> {
    if (!apiInterface?.closePosition) throw new Error('close position only supported on RESTv2')
    return apiInterface.closePosition({ position_id: this.id })
  }

  orderToClose (apiInterface?: unknown): Order {
    const { symbol, amount } = this
    return new Order({
      symbol,
      type: Order.type.MARKET,
      amount: +amount * -1,
      flags: Order.flags.REDUCE_ONLY | Order.flags.POS_CLOSE
    }, apiInterface as never)
  }

  toString (): string {
    const { symbol = '', amount, price, status, id, basePrice, marginFunding, pl, liquidationPrice } = this
    const market = `${symbol.substring(1, 4)}/${symbol.substring(4)}`

    return [
      id && `(id: ${id})`,
      'position on', market,
      status && `(${status})`,
      'for', prepareAmount(amount),
      '@', preparePrice(price),
      `(base price ${preparePrice(basePrice)})`,
      'pl', prepareAmount(pl),
      'liq', preparePrice(liquidationPrice),
      `[funding ${prepareAmount(marginFunding)}]`
    ].filter(Boolean).join(' ')
  }

  static validate (data: unknown): Error | null {
    return super.validate({
      data, fields,
      validators: {
        symbol: symbolValidator, status: stringValidator, amount: amountValidator,
        basePrice: priceValidator, marginFunding: numberValidator,
        marginFundingType: stringValidator, pl: numberValidator, plPerc: numberValidator,
        liquidationPrice: numberValidator, leverage: numberValidator, id: numberValidator,
        mtsCreate: dateValidator, mtsUpdate: dateValidator, type: stringValidator,
        collateral: numberValidator, collateralMin: numberValidator
      }
    })
  }

  static status: Record<string, string> = {}
}

for (const s of statuses) Position.status[s] = s
