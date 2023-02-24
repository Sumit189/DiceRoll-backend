require("dotenv").config();
const apiResponse = require("../helpers/apiResponse");
const nft = require("../helpers/nftTemplate");
const nodeHtmlToImage = require("node-html-to-image");
const puppeteer = require("puppeteer");
const FormData = require("form-data");
const axios = require("axios");
const fs = require("fs");

exports.generate = [
  // Process request after validation and sanitization.
  async (req, res) => {
    try {
      const diceResults = req.body.diceResults;
      const html = nft.template({ diceResults: diceResults });
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
      // res.set('Content-Type', 'text/html');
      // res.send(Buffer.from(html));
      const formData = new FormData();
      formData.append(
        "instructions",
        JSON.stringify({
          parts: [
            {
              html: "document",
            },
          ],
          output: {
            type: "image",
            format: "png",
            dpi: 300,
          },
        })
      );
      formData.append("document", html);
      (async () => {
        try {
          const response = await axios.post(
            "https://api.pspdfkit.com/build",
            formData,
            {
              headers: formData.getHeaders({
                Authorization:
                  "Bearer pdf_live_KjgFjCLK7XAud8Tri5jwrXUoA0ORNQqMsQu6lxlsyra",
              }),
              responseType: 'arraybuffer'
            }
          ).then(response => {
            res.set('Content-Type', 'image/png');
            res.send(Buffer.from(response.data, 'binary'));
          });

        } catch (e) {
          console.log(e);
        }
      })();

    // res.contentType("text/html");
    // res.send(html);
    } catch (err) {
      console.log(err);
      return apiResponse.ErrorResponse(res, err);
    }
  },
];
