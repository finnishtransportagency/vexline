/*

* Copyright 2024 Väylävirasto, Finnish Transport Infrastructure Agency
*

* Licensed under the EUPL, Version 1.2 or – as soon they will be approved by the European Commission - subsequent versions of the EUPL (the "Licence");
* You may not use this work except in compliance with the Licence.
* You may obtain a copy of the Licence at:
*
* https://joinup.ec.europa.eu/sites/default/files/custom-page/attachment/2020-03/EUPL-1.2%20EN.txt
*
* Unless required by applicable law or agreed to in writing, software distributed under the Licence is distributed on an "AS IS" basis,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the Licence for the specific language governing permissions and limitations under the Licence.
*/

const express = require("express");
const multer  = require("multer");
const streamifier = require("streamifier");
const dotenv = require('dotenv');
dotenv.config();
const crypto = require('crypto');

const convert= require("./lib/convert.js");

// Counter for each unique convertion process.
const rowCounter = require('./lib/row_counter.js');

const CACHE_EXPIRATION_TIMEOUT = 60 * 60 * 1000;

const app = express();
const port = process.env.ENV_UI_PORT || 80;
const path = process.env.ENV_APP_PATH || "/vexline";

console.log('appPath: ' + path);

const server = app.listen(port, () => console.log("Started at port " + port));

server.timeout = 180000;

var storage = multer.memoryStorage();
var upload = multer({ storage: storage });

app.locals.files = {};

app.use(path, express.static("public"));
app.use(path +"/bower_components", express.static("bower_components"));
app.use(path +"/excel_templates", express.static("excel_templates"));


app.post(path +"/upload", upload.single('file'), async function (req, res) {
  // Create UUID for each uploaded file
  let conversionUuid = crypto.randomUUID();

  // Add row counters to a global row counter object for each unique conversion process.
  // This counter will be used to create unique IDs for each row, and to show the progress of the convertion to the user via UI.
  rowCounter.initialize(conversionUuid);

  var filenameBodyNew = replaceFileExtension(req.file.originalname);
  var filenameResult = filenameBodyNew + '.csv';
  
  let returnParams = req.body.checkedValues;
  let limitingParams = JSON.parse(req.body.limits);
  var fileType = req.file.originalname.split('.').pop();

  if (returnParams.includes('GPKG')) {
    filenameResult = filenameBodyNew + '.gpkg';
  }

  // All conversion parameters given by the user
  let conversionParams = {
    returnParams,
    limitingParams
  };

  let conversionMetadata = {
    fileName : filenameBodyNew,
    uuid : conversionUuid
  };

  // Start the conversion process the and handle the result.
  convert(req.file.buffer, conversionParams, conversionMetadata, fileType)
    .then(data => {
      app.locals.files[conversionUuid] = {
        valid: true,
        name: filenameResult,
        uuid: conversionUuid,
        mimetype: req.file.mimetype,
        buffer: data.buffer,
        errorBuffer: data.errorBuffer,
        metadata: data.metadata 
      };
      setTimeout(() => { delete app.locals.files[conversionUuid]; }, CACHE_EXPIRATION_TIMEOUT);
    })
    .catch(err => {
      console.log(err.stack);
      app.locals.files[conversionUuid] = { valid: false, errorType: err.name };
    });

  console.log("File uploaded: " + filenameResult);

  // Initialize the status of the conversion. This placeholder tells client-side that the conversion is in progress when status checks are made.
  app.locals.files[conversionUuid] = 'pending';

  // Send the UUID to the client so it can start checking the status of the convertion.
  res.end(conversionUuid, 'latin1');
});


app.get(path + '/status/:uuid', function(req, res) {
  // This handler answers status checks of the conversion.
  let uuid = req.params.uuid;
  let filePromise = app.locals.files[uuid];
  
  // Set appropriate status wether the promise is fullfilled, rejected or pending.
  // Promise state is determined by the content of the app.locals.files[conversion_UUID].
  if (!filePromise) {
    rowCounter.removeCounters(uuid);
    console.error('Requested file not found!');
    res.status(404).json({});
  } else if (filePromise.valid === false) {
    rowCounter.removeCounters(uuid);
    console.error('Conversion failed!: ' + filePromise.errorType);
    res.status(400).json(filePromise.errorType);
  } else if (filePromise.buffer) {
    rowCounter.removeCounters(uuid);
    console.log('File ready!: ' + filePromise.name);
    res.status(200).json(filePromise.metadata);
  } else {
    res.status(202).json({});
  }
});


// Download successfull rows. Download URL can be called after the status check is answered with code 200 (conversion ready).
app.get(path + '/download/:uuid', function(req, res) {
  let uuid = req.params.uuid;
  let filePromise = app.locals.files[uuid];

  if (!filePromise || filePromise.valid === false) {
    res.status(404).send('No such file or conversion failed');
  } else if (!filePromise.buffer) {
    res.status(202).send('Conversion in progress');
  } else {
    console.log("Download ready 200: /download/" + filePromise.name);
    res.setHeader("Content-disposition", "attachment; filename=" + filePromise.name);
    res.setHeader("Content-type", filePromise.mimetype);
    streamifier.createReadStream(filePromise.buffer).pipe(res);
  }
});


// Download error rows. Download URL can be called after the status check is answered with code 200 (conversion ready).
app.get(path + '/downloadError/:uuid', function(req, res) {
  let uuid = req.params.uuid;
  let filePromise = app.locals.files[uuid];

  const getErrorFileName = (fileName) => {
    const lastSepIndex = fileName.lastIndexOf('.');
    const body = fileName.substring(0, lastSepIndex);
    // Error rows are always in CSV-format
    const extension = '.csv';
    return body + '_ErrorRows' + extension;
  }

  if (!filePromise || filePromise.valid === false) {
    res.status(404).send('No such file or conversion failed');
  } else if (!filePromise.buffer) {
    res.status(202).send('Conversion in progress');
  } else {
    console.log("Download ready 200: /download/" + filePromise.name);
    res.setHeader("Content-disposition", "attachment; filename=" + getErrorFileName(filePromise.name));
    res.setHeader("Content-type", filePromise.mimetype);
    streamifier.createReadStream(filePromise.errorBuffer).pipe(res);
  }
});


function replaceFileExtension(filename) {
  // Split the filename into parts on the period character
  var parts = filename.split('.');

  // Remove the last part (the file extension)
  parts.pop();

  // Add the new extension
  parts[parts.length - 1] += '_TULOS';

  // Join the parts back together
  var newFilename = parts.join('.');

  return newFilename;
}