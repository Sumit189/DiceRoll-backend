var express = require("express");
const NFTController = require("../controllers/NFTController");

var router = express.Router();

router.post("/generate", NFTController.generate);
module.exports = router;