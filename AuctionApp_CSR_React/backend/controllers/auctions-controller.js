import express from 'express'
import { Op } from 'sequelize'
import { isAuctionActive } from '../common/is-auction-active.js'
import { createOffer } from '../database/database-models-factory.js'
import { Auction } from '../models/auction.js'
import { Offer } from '../models/offer.js'
import { User } from '../models/user.js'
import { jwtMiddleware } from '../security/jwt-middleware.js'

export const auctionsRouter = express.Router()

auctionsRouter.get('/auctions', async function (req, res, next) {
  const currentDateTime = new Date()
  const auctions = await Auction.findAll({
    where: {
      endDateTime: {
        [Op.gte]: currentDateTime
      }
    },
    attributes: auctionAttributes,
    order: [['startDateTime', 'ASC']],
    include: includeUser
  })

  return res.json(auctions)
})

auctionsRouter.get('/auctions/:id', async function (req, res, next) {
  const auction = await getAuctionFromRequest(req)
  if (!auction || !isAuctionActive(auction)) {
    return res.sendStatus(404)
  }

  return res.json(auction)
})

auctionsRouter.put('/auctions/:id/add-offer', jwtMiddleware, async function (req, res, next) {
  const auction = await getAuctionFromRequest(req)
  if (!isAuctionActive(auction)) {
    return res.status(400).json('Aukcja została już zakończona - nie dodano nowej oferty')
  }

  const amount = req.body.amount
  if (!auction || amount <= 0) {
    return res.status(400).json('Nie podano poprawnych danych!')
  }

  const user = await User.findByPk(req.userId)
  if (auction.getDataValue('userId') === req.userId) {
    return res.status(400).json('Nie możesz brać udziału we własnym przetargu')
  }

  const existingOffer = await Offer.findOne({ where: { auctionId: auction.getDataValue('id'), userId: req.userId } })
  if (!existingOffer) {
    await createOffer(amount, new Date(), auction, user)

    return res.status(201).json('Pomyślnie utworzono ofertę')
  } else {
    existingOffer.setAttributes({ amount, dateTime: new Date() })
    await existingOffer.save()

    return res.status(200).json('Składałeś już ofertę - jej wartość została zastąpiona nową wartością')
  }
})

async function getAuctionFromRequest(req) {
  const id = req.params.id
  return await Auction.findByPk(id, {
    attributes: auctionAttributes,
    include: includeUser
  })
}

const includeUser = {
  model: User,
  as: 'user',
  attributes: ['id', 'fullName']
}

const auctionAttributes = { exclude: ['maxAmount'] }
