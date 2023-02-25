require("dotenv").config();
const apiResponse = require("../helpers/apiResponse");
const nft = require("../helpers/nftTemplate");
const FormData = require("form-data");
const axios = require("axios");
const fs = require('fs');
const os = require('os');
const path = require('path');
const async = require('async')

exports.generate = [
  // Process request after validation and sanitization.
  async (req, res) => {
    try {
      const diceResults = req.body.diceResults;
      nft.template({ diceResults: diceResults }, (data, err) => {
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
        formData.append("document", data.html);
        (async () => {
          try {
            const response = await axios.post(
              "https://api.pspdfkit.com/build",
              formData,
              {
                headers: formData.getHeaders({
                  Authorization: process.env.PDPDFKIT_KEY,
                }),
                responseType: 'arraybuffer'
              }
            ).then(response => {
              if (response.data) {
                processFurther({image: response.data, name: data.name, desc: data.desc, diceResults: diceResults}, (data, err) => {
                    if (err) {
                        res.negotiatet(err)
                    }
                    apiResponse.successResponse(res, "Created NFT");
                });
              }
              apiResponse.ErrorResponse(res, "NFT not created")
            //   res.set('Content-Type', 'image/png');
            //   res.send(Buffer.from(response.data, 'binary'));
            });
  
          } catch (e) {
            console.log(e);
          }
        })();
      });
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

    // res.contentType("text/html");
    // res.send(html);
    } catch (err) {
      console.log(err);
      return apiResponse.ErrorResponse(res, err);
    }
  },
];

const processFurther = (opts, cb) => {
    const {
        name,
        desc,
        image,
        diceResults
    } = opts

    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.jpg`;
    const tempFilePath = path.join(os.tmpdir(), uniqueFileName);
    fs.writeFileSync(tempFilePath, image);

    async.waterfall([
        async (callback) => {
            console.log("step 1")
            var data = JSON.stringify({
                query: `mutation CreateFileUploadUrl($name: String!, $description: String, $options: CreateFileOptionsInput!) {
                    createFileUploadUrl(name: $name, description: $description, options: $options) {
                        id
                        name
                        url
                        state
                    }
                }`,
                variables: {"name": name, "description": desc,"options":{"uploadToIPFS":true,"contentType":"image/jpeg"}}
                });
            
                var config = {
                    method: 'post',
                    maxBodyLength: Infinity,
                    url: 'https://api.staging.niftory.com/v1/graphql',
                    headers: { 
                        'X-Niftory-Client-Secret': process.env.NIFTORY_CS, 
                        'X-Niftory-API-Key': NIFTORY_APIKEY, 
                        'Content-Type': 'application/json'
                    },
                    data : data
                };
            
                axios(config)
                .then(function (response) {
                    callback(null, response.data);
                })
                .catch(function (error) {
                    callback(err, null)
                });
        },
        
        async (uploadData, callback) => {
            console.log("step 2")
            try {
                const image = fs.readFileSync(tempFilePath);
                const response = await axios({
                    method: 'PUT',
                    url: uploadData.url,
                    data: image,
                    headers: {
                    'Content-Type': 'image/jpeg'
                    }
                });
                callback({fileId: uploadData.fileId})
            } catch (error) {
                callback(null, err)
            }
        },
        async (fileId, callback) => {
            console.log("step 3")
            var data = JSON.stringify({
                query: `mutation CreateModel($setId: ID!, $data: NFTModelCreateInput!) {
                  createNFTModel(setId: $setId, data: $data) {
                      id
                      quantity
                      title
                      attributes
                  }
              }`,
                variables: {"setId": process.env.NIFTORY_SETID, "data":{"title": name,"description": desc,"quantity": 1,"content":{"fileId": fileId,"posterId": fileId},"metadata":{"list": diceResults,"property":{"bag":"of","values":1,"these":"are private to your app, they don't get put on-chain"}},"attributes":{"json":"attributes","property":{"bag":"of","values":1,"these":"are private to your app, they don't get put on-chain"}}}}
              });
              
              var config = {
                method: 'post',
              maxBodyLength: Infinity,
                url: 'https://api.staging.niftory.com/v1/graphql',
                headers: { 
                  'X-Niftory-Client-Secret': process.env.NIFTORY_CS, 
                  'X-Niftory-API-Key': process.env.NIFTORY_APIKEY, 
                  'Content-Type': 'application/json'
                },
                data : data
              };
              
              axios(config)
              .then(function (response) {
                callback(null, null)
              })
              .catch(function (error) {
                callback(null, err)
              });              
        },

        (callback) => {
            console.log("step 4")
            // Delete the temporary file
            fs.unlinkSync(tempFilePath);
            callback(null, null)
        }
      ], (data, err) => {
        console.log("final step")
        if (err) {
          cb(null, err)
        } 
        cb(true, null)
    });
  }
