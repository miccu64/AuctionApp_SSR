import express from 'express'
import { Op } from 'sequelize'
import { Auction } from '../models/auction.js'
import { Offer } from '../models/offer.js'
import { isAuctionActive } from '../common/is-auction-active.js'

export const historyRouter = express.Router()

historyRouter.get('/history', async function (req, res, next) {
  const currentDateTime = new Date()
  const auctions = await Auction.findAll({
    where: {
      endDateTime: {
        [Op.lt]: currentDateTime
      }
    },
    include: { model: Offer, as: 'offers' }
  })

  return res.json(auctions)
})

historyRouter.get('/history/:id', async function (req, res, next) {
  const id = req.params.id
  const auction = await Auction.findByPk(id, {
    include: { model: Offer, as: 'offers' }
  })

  if (isAuctionActive(auction)) {
    return res.sendStatus(404)
  }

  const maxAmount = auction.getDataValue('maxAmount')
  const offers = (await Offer.findAll({ where: { auctionId: id } })).sort(
    (a, b) => a.getDataValue('amount') - b.getDataValue('amount')
  )
  const properOffers = offers.filter((o) => o.getDataValue('amount') <= maxAmount)
  const otherOffers = offers.filter((o) => o.getDataValue('amount') > maxAmount)

  return res.json({ auction, properOffers, otherOffers })
})
