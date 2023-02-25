require("dotenv").config();
const apiResponse = require("../helpers/apiResponse");
const nft = require("../helpers/nftTemplate");
const FormData = require("form-data");
const axios = require("axios");
const fs = require('fs');
const os = require('os');
const path = require('path');
const async = require('async')
const chromium = require('chrome-aws-lambda');

exports.generate = [
  // Process request after validation and sanitization.
  async (req, res) => {
    try {
      const diceResults = req.body.diceResults;
      nft.template({ diceResults: diceResults }, (data, err) => {
        if (err) {
            apiResponse.ErrorResponse(res, err)
        }
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
                  Authorization: process.env.PSPDF_KEY,
                }),
                responseType: 'arraybuffer'
              }
            ).then(response => {
              if (response.data) {
                processFurther({image: response.data, name: data.name, desc: data.desc, diceResults: diceResults}, (data, err) => {
                    if (err) {
                        return apiResponse.ErrorResponse(res, err)
                    }
                    return apiResponse.successResponse(res, "Created NFT");
                });
              } else {
                return apiResponse.ErrorResponse(res, "NFT not created")
              }
            //   res.set('Content-Type', 'image/png');
            //   res.send(Buffer.from(response.data, 'binary'));
            });
  
          } catch (e) {
            console.log(e);
          }
        })();
      });
    } catch (err) {
      console.log(err);
      return apiResponse.ErrorResponse(res, err);
    }
  },
];

exports.screenshot = [
  // Process request after validation and sanitization.
  async (req, res) => {
    const url = req.body.url
    try {
      let browser = chromium.puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });
      console.log("here");
      //let page = await browser.newPage();
      //page.goto(url);
      console.log("here2");
      //const screenshot = page.screenshot({ encoding: 'base64' });
      return apiResponse.successResponseWithData(res, "Here: ", "screenshot")
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
        (callback) => {
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
                'X-Niftory-API-Key': process.env.NIFTORY_APIKEY, 
                'Content-Type': 'application/json'
            },
            data : data
            };
            
            axios(config)
            .then(function (response) {
                callback(null, response.data?.data?.createFileUploadUrl);
            })
            .catch(function (error) {
                console.log("err: ", error)
                callback(error, null)
            });              
        },
        
        (uploadData, callback) => {
            console.log("step 2")
            try {
                const image = fs.readFileSync(tempFilePath);
                const response = axios({
                    method: 'PUT',
                    url: uploadData.url,
                    data: image,
                    headers: {
                    'Content-Type': 'image/jpeg'
                    }
                });
                callback(null, {fileId: uploadData.id})
            } catch (error) { 
                console.log(error);
                callback(error, null)
            }
        },
        (data, callback) => {
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
                variables: {"setId": process.env.NIFTORY_SETID,"data":{"title":name,"description":desc,"quantity":1,"content":{"fileId":data.fileId,"posterId":data.fileId},"metadata":{"dice":diceResults,"property":{"bag":"of","values":1,"these":"are private to your app, they don't get put on-chain"}},"attributes":{"json":"attributes","property":{"bag":"of","values":1,"these":"are private to your app, they don't get put on-chain"}}}}
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
            console.log(JSON.stringify(response.data));
            callback(response, null)
            })
            .catch(function (error) {
            console.log(error);
            callback(null, err)
            });                           
        }
      ], (data, err) => {
        console.log("final step")
        console.log("deleting file")
        fs.unlinkSync(tempFilePath);

        if (err) {
          cb(null, err)
        } 
        cb(true, null)
    });
  }
