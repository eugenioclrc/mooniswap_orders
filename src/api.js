// Api
const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const checkOrder = require('./checkOrder.js');

const PORT = process.env.PORT || 5000;

module.exports = async () => {
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  app.use(cors());

  app.listen(PORT, () => console.info(`Listening on ${PORT}`));

  app.get('/order/:order', async (req, res) => res.json(
    await process.redis.getValue(['order', req.params.order]),
  ));

  app.get('/orders', async (_, res) => res.json(
    await process.redis.getValues('order:*'),
  ));

  app.post('/addOrder', async (req, res) => {
    const order = req.body;

    const key = ['order', order.signature].join(':');

    if (await process.redis.getValue(key)) {
      res.status(200).send('The order exists');
      return;
    }

    try {
      order.orderId = process.web3.utils.soliditySha3(
        { t: 'address', v: order.mooniswapPoolAddress },
        { t: 'address', v: order.fromToken },
        { t: 'address', v: order.toToken },
        { t: 'uint256', v: order.fromAmount },
        { t: 'uint256', v: order.minReturn },
        { t: 'uint256', v: order.maxLoss },
        { t: 'address', v: order.referral },
        { t: 'uint256', v: order.expiry },
        { t: 'bytes32', v: order.salt },
      );

      order.owner = process.web3.eth.accounts.recover(order.orderId, order.signature);
    } catch (error) {
      res.status(200).send('Wrong inputs: ' + JSON.stringify(order));
      return;
    }

    order.message = await checkOrder.checkNewOrder(order);

    if (order.message === 'OK') {
      await process.redis.setAsync(key, JSON.stringify(order));
      res.status(200).send(order);
    } else {
      res.status(200).send(order.message);
    }
  });
};