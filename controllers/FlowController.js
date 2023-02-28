require("dotenv").config();
const fcl = require("@onflow/fcl");
const apiResponse = require("../helpers/apiResponse");
const { authorizationFunction } = require("../helpers/authorization");
const NFTController = require("../controllers/NFTController");

const address = "0228cfaf738ed8f5"

fcl
  .config()
  .put("accessNode.api", "https://rest-testnet.onflow.org")
  .put("flow.network", "testnet")
  .put("discovery.wallet", "https://fcl-discovery.onflow.org/testnet/authn");

const controller = {
  rollDice: async (req, res) => {
    try {
      //validate request
      if (!req.body.quantity || !req.body.purpose || req.body.quantity < 1 || req.body.quantity > 100 || req.body.purpose.length > 1000 || req.body.purpose.length < 1) {
        return apiResponse.ErrorResponse(res, "Invalid request");
      }

      //generate random number between 1 and 6
      const result = await fcl.send([
        fcl.transaction`
        import Diceroller from 0x0228cfaf738ed8f5
        transaction(number: UInt256, purpose: String) {
          prepare(acct: AuthAccount) {
            let random = UInt256(unsafeRandom())
            let rng <- Diceroller.create(seed: random)
            log(rng.range(1, 6, quantity:number, purpose: purpose))
            destroy rng
          }
        }
        `,
        fcl.args([
          fcl.arg(req.body.quantity, fcl.t.UInt256),
          fcl.arg(req.body.purpose, fcl.t.String),
        ]),
        fcl.proposer(authorizationFunction),
        fcl.authorizations([authorizationFunction]),
        fcl.payer(authorizationFunction),
      ]);
      console.log(result);
      const transaction = await fcl.tx(result.transactionId).onceSealed();
      let event = transaction.events.find(x => x.type === `A.${address}.Diceroller.DiceRollSetResult`)
      event.data.result = event.data.result.map(i=>Number(i))
      apiResponse.successResponse(res, {
        result: event,
        raw: transaction,
      });
    } catch (err) {
      console.log(err);
      return apiResponse.ErrorResponse(res, err);
    }
  },
  quickRollDice: async (req, res) => {
    try {
      //validate request
      if (!req.body.quantity || !req.body.purpose || req.body.quantity < 1 || req.body.quantity > 100 || req.body.purpose.length > 1000 || req.body.purpose.length < 1) {
        return apiResponse.ErrorResponse(res, "Invalid request");
      }

      //generate random number between 1 and 6
      const result = await fcl.send([
        fcl.transaction`
        import Diceroller from 0x0228cfaf738ed8f5
        transaction(number: UInt256, purpose: String) {
          prepare(acct: AuthAccount) {
            let random = UInt256(unsafeRandom())
            let rng <- Diceroller.create(seed: random)
            log(rng.range(1, 6, quantity:number, purpose: purpose))
            destroy rng
          }
        }
        `,
        fcl.args([
          fcl.arg(req.body.quantity, fcl.t.UInt256),
          fcl.arg(req.body.purpose, fcl.t.String),
        ]),
        fcl.proposer(authorizationFunction),
        fcl.authorizations([authorizationFunction]),
        fcl.payer(authorizationFunction),
      ]);
      apiResponse.successResponse(res, result);

      fcl.tx(result.transactionId).subscribe((tx) => {
        if(tx?.status === 4) {
          let dice_result = tx.events.find((e) => e.type === "A.0228cfaf738ed8f5.Diceroller.DiceRollSetResult")
          dice_result = dice_result.data.result.map(i=>Number(i))
          NFTController.generateWithoutResponse(dice_result)
        }
      })
    } catch (err) {
      console.log(err);
      return apiResponse.ErrorResponse(res, err);
    }
  },
};

module.exports = controller;
