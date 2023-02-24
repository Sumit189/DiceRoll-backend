require("dotenv").config();
const apiResponse = require("../helpers/apiResponse");
const nft = require("../helpers/nftTemplate");
const nodeHtmlToImage = require('node-html-to-image')
const puppeteer = require('puppeteer');

exports.generate = [
    // Process request after validation and sanitization.
    async (req, res) => {
        try {
            const diceResults = req.body.diceResults
            const html = nft.template({diceResults: diceResults})
            // const browser = await puppeteer.launch();
            // const page = await browser.newPage();
            // await page.setViewport({
            //     width: 960,
            //     height: 760,
            //     deviceScaleFactor: 1,
            // });            
            // await page.setContent(html);
            // let image = await page.screenshot({path: "./example.png", encoding: "base64"});
            // console.log(image)
            // await browser.close();
            res.set('Content-Type', 'text/html');
            res.send(Buffer.from(html));
        }
        catch (err) {
			return apiResponse.ErrorResponse(res, err);
		}
    }
]



