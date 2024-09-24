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

const axios = require('axios');
const R = require("ramda");
const { stringify } = require('wkt');
const XLSX = require("xlsx");
const Papa = require('papaparse');
const dotenv = require('dotenv');
const fs = require('fs').promises;
const util = require('node:util');
const ChunkProcessor = require('./chunk_processor');
const exec = util.promisify(require('node:child_process').exec);
const errors = require('./custom_errors');
dotenv.config();
module.exports = convert;
const rowCounter = require('./row_counter.js');

// VKM API URL (from environment variables):
let API_URL = process.env.ENV_VKM_URL
if (!R.startsWith('https', API_URL)) {
  API_URL = 'https://' + API_URL
}

const RETURN_VALUES = "1,2,3,4,5";
const VKM_URL = API_URL + "/viitekehysmuunnin/muunna";
const IDENTIFIER_KEY = "tunniste";


// all VKM-params
const VALID_VKM_PARAMS = [
  'x', 'y', 'x_loppu', 'y_loppu', 'tie', 'ajorata', 'osa', 'etaisyys', 'ajorata_loppu', 'osa_loppu', 'etaisyys_loppu',
  'hallinnollinen_luokka', 'kuntanimi', 'katunimi', 'katunumero', 'ely', 'elynimi', 
  'ualue', 'ualuenimi', 'maakuntakoodi', 'maakuntanimi', 'tunniste', 'tilannepvm', 'kohdepvm', 'kmtk_id', 'link_id', 'kmtk_id_loppu', 'link_id_loppu',
  'm_arvo', 'm_arvo_loppu', 'vaylan_luonne', 'ratanumero', 'ratakilometri', 'ratametri', 'ratakilometri_loppu', 'ratametri_loppu',
]


// Wanted order of the important VKM-properties in output
const IMPORTANT_VKM_PROPERTIES_ORDER = [
  'tie', 'ajorata', 'osa', 'etaisyys', 'osa_loppu', 'etaisyys_loppu', 'ajorata_loppu', 'mitattu_pituus', 'kohdepvm', 
  'tie_original', 'ajorata_original', 'osa_original', 'etaisyys_original', 'osa_loppu_original', 'etaisyys_loppu_original', 'tilannepvm',
  'kuntakoodi', 'kuntanimi', 'kuntanimi_se', 'katunimi', 'katunimi_se', 'katunumero',
  'ely', 'elynimi', 'ualue', 'ualuenimi', 'maakuntakoodi', 'maakuntanimi', 'maakuntanimi_se',
  'vaylan_luonne', 'tietyyppi', 'hallinnollinen_luokka',
  'link_id', 'kmtk_id', 'm_arvo',

  'kuntakoodi_loppu', 'kuntanimi_loppu', 'kuntanimi_se_loppu', 'katunimi_loppu', 'katunimi_se_loppu', 'katunumero_loppu',
  'ely_loppu', 'elynimi_loppu', 'ualue_loppu', 'ualuenimi_loppu', 'maakuntakoodi_loppu', 'maakuntanimi_loppu', 'maakuntanimi_se_loppu',
  'vaylan_luonne_loppu', 'tietyyppi_loppu', 'hallinnollinen_luokka_loppu',
  'link_id_loppu', 'kmtk_id_loppu', 'm_arvo_loppu'
]

// VKM-properties translations for translating different address syntax to VKM syntax
const VKM_PROPERTIES_TRANSLATIONS = {
  'tienumero' : 'tie', 'Tie' : 'tie', 'TIE' : 'tie',
  'alkuosa' : 'osa', 'aosa' : 'osa', 'Osa' : 'osa', 'OSA' : 'osa',
  'loppuosa' : 'osa_loppu', 'losa' : 'osa_loppu',
  'alkuetaisyys' : 'etaisyys', 'aet' : 'etaisyys', 'aetaisyys' : 'etaisyys', 'alkuetäisyys' : 'etaisyys', 'etäisyys' : 'etaisyys', 
  'Etaisyys' : 'etaisyys', 'ETAISYYS' : 'etaisyys',
  'loppuetaisyys' : 'etaisyys_loppu', 'let' : 'etaisyys_loppu', 'letaisyys' : 'etaisyys_loppu', 'loppuetäisyys' : 'etaisyys_loppu',
  'ajoratanumero' : 'ajorata', 'ajr' : 'ajorata', 'Ajorata' : 'ajorata', 'AJORATA' : 'ajorata'
}

// Input VKM properties that will be copied as bonus-properties to the output file.
const VKM_PROPERTIES_TO_COPY = [
  'tie', 'ajorata', 'osa', 'etaisyys', 'osa_loppu', 'etaisyys_loppu', 'ajorata_loppu', 
  'mitattu_pituus', 'tunniste', 'tilannepvm', 'kohdepvm'
]


const VKM_PROPERTIES_TO_RENAME = [
  'tie', 'ajorata', 'osa', 'etaisyys', 'osa_loppu', 'etaisyys_loppu', 'ajorata_loppu', 
  'mitattu_pituus'
]


// Keys to remove depending on users choice.
const REMOVABLE_VKM_KEYS_1 = [
  'vaylan_luonne', 'tietyyppi', 'hallinnollinen_luokka',
  'vaylan_luonne_loppu', 'tietyyppi_loppu', 'hallinnollinen_luokka_loppu',
  'vertikaalisuhde', 'vertikaalisuhde_loppu', 'tie_loppu'
]


// Keys to remove in every situation.
const REMOVABLE_VKM_KEYS_2 = [
  'tie_loppu', 'tietyyppi', 'tietyyppi_loppu'
]


const REMOVABLE_COORDINATE_KEYS = [
  'x', 'y', 'z', 'x_loppu', 'y_loppu', 'z_loppu'
]


const VALUE_TRANSLATIONS = {
  'ely' : {
    'uud' : '1', 'var' : '2', 'kas' : '3', 'pir' : '4',
    'pos' : '8', 'kes' : '9', 'epo' : '10', 'pop': '12', 'lap' : '14',

    'uusimaa' : '1', 'varsinais-suomi' : '2', 'kaakkois-suomi' : '3',
    'pirkanmaa' : '4', 'pohjois-savo' : '8', 'keski-suomi' : '9', 'etela-pohjanmaa' : '10',
    'pohjois-pohjanmaa ja kainuu' : '12', 'lappi' : '14'
  },
  'hallinnollinen_luokka' : {
    'valtio' : '1', 'kunta' : '2', 'yksityinen' : '3'
  },
  'ajorata' : {
    'ajr0' : '0', 'ajr1' : '1', 'ajr2' : '2'
  }
}

//*************** Functions, main

async function convert(buffer, conversionParams, conversionMetadata, fileType) {
  try {
    let parsedInput = await parseInput(buffer, conversionParams, conversionMetadata, fileType);
    let validatedValues = validateValues(parsedInput);
    let convertedValues = await convertValues(validatedValues);
    let outputData = await buildOutput(convertedValues);
    return outputData;
  } catch (err) {
    console.error(err);
    // Reject the promise with the caught exception.
    return Promise.reject(err);
  }
}


//*************** Parse input

async function parseInput(buffer, conversionParams, conversionMetadata, fileType = 'xlsx') {
  
  const parse = (async buffer => {
    console.log('Parsing input.');

    // Initialize a variable to hold the worksheet data
    let worksheet;
    
    // Check the file type
    if (fileType === 'xlsx') {
      // If the file type is XLSX, read the buffer and extract the first worksheet
      const workbook = XLSX.read(buffer, {type: 'buffer', cellDates: true});
      worksheet = workbook.Sheets[workbook.SheetNames[0]];
    } else if (fileType === 'csv') {
      // If the file type is CSV, convert the buffer to a string and create a worksheet object
      const csvString = buffer.toString();
      const json = Papa.parse(csvString, {delimiter: ';', header: true}).data;
      worksheet = XLSX.utils.json_to_sheet(json);
    } else {
      // If the file type is not supported, throw an error
      throw new errors.FileTypeError('Parsing input failed!');
    }
    
    // Convert the worksheet data to an array of arrays
    var table = XLSX.utils.sheet_to_json(worksheet, {header: 1, raw: true});
    
    // Array to save the original header names, that are translated to VKM syntax, for later use
    let originalKeys = {};

    let tableData = {table, originalKeys};

    // Parse the table data
    const content = parseTable(tableData);

    // Clean and validate limitingParams.
    let params = conversionParams.limitingParams;
    let cleanParams;
    try {
      cleanParams = validateLimitingParams(params);
    } catch (err) {
      throw err;
    }
    conversionParams.limitingParams = cleanParams;

    // Switch that tells which input keys to save as bonus keys.
    let saveInputRoadAddress = false;
    if (conversionParams.returnParams.includes('saveInput')) {
      saveInputRoadAddress = true;
    }
    
    // Split the array of objects into two arrays: vkmRows (contains data for VKM-API requests) and bonusRows (contains custom columns added by user)
    let twoArrays = createTwoArrays(content, conversionParams.limitingParams, saveInputRoadAddress, conversionMetadata.uuid);

    // Return an object containing the desired information
    return {
      vkmRows : twoArrays.vkmArray, 
      bonusRows : twoArrays.bonusArray, 
      conversionParams,
      conversionUuid : conversionMetadata.uuid,
      fileName : conversionMetadata.fileName,
      originalKeys
    }
  });

  try {
    // Call the parse function.
    return await parse(buffer);
  } catch (error) {
    // If an error occurs during parsing, throw it.
    console.error("Parsing input failed:", error);
    throw(error);
  }
}


function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function formatDateInArray(array) {
  // Iterate over each object in the array
  for (let obj of array) {
    // Iterate over each key in the object
    for (let key in obj) {
      // Check if the value is a Date object
      if (obj[key] instanceof Date) {
        // Convert the date to the dd.mm.yyyy format
        obj[key] = obj[key].toLocaleDateString('fi-FI', {day: '2-digit', month: '2-digit', year: 'numeric'});
      }
    }
  }
}


function parseTable(tableData) {
  // Translate header keys to VKM syntax
  tableData.table[0] = translateToVkmSyntax(tableData.table[0], tableData.originalKeys);

  const header = tableData.table[0];

  // Checks if tunniste field is in headers.
  let tunnisteIsInArray = header.some(item => item.trim().toLowerCase() === IDENTIFIER_KEY.trim().toLowerCase());

  // Checks if any of the header fields are VKM params.
  const headerIsValid = header.some(function(item) {
    return R.includes(item.trim().toLowerCase(), VALID_VKM_PARAMS);
  });

  if (headerIsValid) {
    const onlyNonEmptyRows = R.reject(R.all(R.isEmpty));
    var vkmRows = tableToObjects(onlyNonEmptyRows(tableData.table));
    tableData.table = null;
    formatDateInArray(vkmRows);
    return { vkmRows, tunnisteIsInArray };
  } else {
    throw new errors.MissingParamsError("You must specity a header row with valid VKM parameters");
  }
}


function translateToVkmSyntax(keys, originalKeys) {
  return keys.map(key => {
    let lowerCaseKey = key.trim().toLowerCase();
    let trimmedKey = key.trim();
    if (VKM_PROPERTIES_TRANSLATIONS[trimmedKey]) {
      // Save the original translated keys on another object for later
      let vkmKey = VKM_PROPERTIES_TRANSLATIONS[trimmedKey];
      originalKeys[vkmKey] = key;
      return vkmKey;
      
    } else if (VKM_PROPERTIES_TRANSLATIONS[lowerCaseKey]) {
      let vkmKey = VKM_PROPERTIES_TRANSLATIONS[lowerCaseKey];
      originalKeys[vkmKey] = key;
      return vkmKey;
    } else {
      // Return the original key if it doesn't match any keys in the translation dictionary
      return key;
    }
  });
}


function translatePropertyValues(obj) {
  // Translate certain values of certain VKM-properties to VKM-syntax if needed.
  let newObj = { ...obj };
  for (let prop in VALUE_TRANSLATIONS) {
    let originalValue;
    if ( typeof obj[prop] === 'string') {
      originalValue = obj[prop].trim().toLowerCase();
    }

    if (obj.hasOwnProperty(prop) && VALUE_TRANSLATIONS[prop].hasOwnProperty(originalValue)) {
      let translatedValue = VALUE_TRANSLATIONS[prop][originalValue]
      newObj[prop] = translatedValue;
    }
  }
  return newObj;
}


function tableToObjects(table) {
  const headers = R.reject(R.isEmpty, R.head(table));
  const content = R.tail(table);
  return R.map(R.zipObj(headers), content);
}


function createTwoArrays(content, limitingParams, saveInputRoadAddress, uuid) {
  let originalArray = content.vkmRows;
  const tunnisteAdded = content.tunnisteIsInArray;

  let vkmKeysToCopy = saveInputRoadAddress ? VKM_PROPERTIES_TO_COPY : ['tunniste', 'tilannepvm', 'kohdepvm']

  let nonBonusKeys = VALID_VKM_PARAMS.filter(element => !vkmKeysToCopy.includes(element));

  let vkmArray = [];
  let bonusArray = [];
 
  originalArray.forEach(obj => {
    let vkmObj = {}, bonusObj = {};

    Object.assign(obj, limitingParams);

    for (let key in obj) {
      // Clean the key to match the standard.
      let cleanKey = key.trim().toLowerCase();
      
      if (VALID_VKM_PARAMS.includes(cleanKey)) {
        vkmObj[cleanKey] = obj[key];
      }

      // Rename certain VKM-keys going into the bonusArray.
      if (!nonBonusKeys.includes(cleanKey)) {
        if (VKM_PROPERTIES_TO_RENAME.includes(cleanKey)) {
          bonusObj[`${cleanKey}_original`] = obj[key];
        } else {
          // Normal non-VKM key can keep its casing and extra spaces.
          bonusObj[key] = obj[key];
        }
      }
    }

    // Add unique ID to each row if it was not added by the user.
    if (tunnisteAdded === false) {
      vkmObj['tunniste'] = rowCounter.getInputRowCount(uuid).toString();
      bonusObj['tunniste'] = rowCounter.getInputRowCount(uuid).toString();
      rowCounter.incrementInputRowCount(uuid);
    }

    vkmArray.push(vkmObj);
    bonusArray.push(bonusObj);
  });

  return {vkmArray, bonusArray};

}


//*************** Validate values


function validateValues(data) {
  console.log('Validating values.');

  const values = data.vkmRows;
  
  var tunnisteet = [];
  for (var i = 0; i < values.length; i++) {
	  if (values[i].tunniste != null) {
		  tunnisteet.push(values[i].tunniste);
	  }
  }
  if (tunnisteet.length > 0) {
	  var uniques = countUnique(tunnisteet);
	  if (uniques < tunnisteet.length) {
		  throw new errors.TunnisteError("Tunniste-values are not unique");
    }
  }
  
  let params = data.conversionParams.limitingParams;
  let cleanParams;
  try {
    cleanParams = validateLimitingParams(params);
  } catch (err) {
    throw err;
  }
  // let cleanParams = validateLimitingParams(params)
  data.conversionParams.limitingParams = cleanParams;

  // Check if there are empty fields in any of the VKM-columns.
  const valid = x => !R.any(R.isNil, R.flatten(R.map(R.values, x)));

  if (valid(values)) {
    console.log('Validating values done.');
    return data;
  } else {
    throw new errors.EmptyFieldsError('Empty fields found in mandatory columns!')
  }
}


function countUnique(iterable) {
  return new Set(iterable).size;
}


function validateLimitingParams(params) {
  let cleanParams = {}
  for (let [key, value] of Object.entries(params)) {
    if (![null, ' ', '', undefined].includes(value)) {
      let cleanValue = value.trim().toLowerCase();
      if (!isValidString(cleanValue)) {
        throw new errors.InvalidParamsError('Invalid string');
      }
      cleanParams[key] = cleanValue;
    }
  }
  return cleanParams;
}


function isValidString(string) {
  // Define the regular expression
  const regex = /^[0-9,. ]*$/;

  // Test the line against the regular expression
  return regex.test(string);
}


function JSONtoValidString(values) {
  for (i = 0; i < values.length; i++) {
    if ('tunniste' in values[i]) {
      values[i].tunniste = values[i].tunniste + '';
    }
    if ('ajorata' in values[i]) {
      values[i].ajorata = values[i].ajorata + '';
    }
    if ('vaylan_luonne' in values[i]) {
      values[i].vaylan_luonne = values[i].vaylan_luonne + '';
    }
  }

  return JSON.stringify(values);
}


async function postData(url, data, retries = 5) {
  let response;
  // Stringifying the JSON-object to be sent in the POST-request.
  var dataString = { json: JSONtoValidString(data) }

  for (let i = 0; i < retries; i++) {
    try {
      response = await axios.post(url, dataString, {
        headers: { 
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
        },
      });
      // If the request is successful, break out of the loop
      if (response) {
        break;
      }
    } catch (error) {
      console.log(error)
      console.error(`Attempt ${i + 1} failed. Retrying after ${i * 2000}ms...`);
      await new Promise(resolve => setTimeout(resolve, i * 2000));
    }
  }
  return response.data;
}


async function makeVkmRequest(array, url, validReturnParams, limitingParams, retries = 3) {
  let responses = [];

  // Counting total rows posted.
  let postedRowsTotal = 0;

  // Counting posted rows before delay.
  let postedRows = 0;

  // Set the number of rows posted in a single POST-request
  var jsonBlockSize = 1000
  var valihaku = isIntervalSearch(Object.keys(array[0]));
  if (valihaku == 'true') {
    jsonBlockSize = 100;
  }

  // Add extra parameters to each row and translate values if needed.
  let newArray = [];
  for (var object of array) {
    object['palautusarvot'] = validReturnParams;
    object['valihaku'] = valihaku;
    let newObject = translatePropertyValues(object);
    newArray.push(newObject);
  }

  // Post rows in chunks
  for (let i = 0; i < newArray.length; i += jsonBlockSize) {
    let chunk = newArray.slice(i, i + jsonBlockSize);
    if ((postedRows + chunk.length) >= 1000) {
      // Wait N seconds between rows posted.
      postedRows = 0;
      await delay(12000);
    }
    var response = await postData(url, chunk, retries);
    responses.push(response);
    postedRows += chunk.length;
    postedRowsTotal += chunk.length;
    console.log('Total rows posted: ' + postedRowsTotal)
  }
  
  return responses;
}


function getCleanArrayElements(header) {
  // Makes each element of the array lowercase and removes spaces around them.
  return header.map((element) => element.toLowerCase().trim());
}


function isIntervalSearch(header) {
  // Check if found VKM pamaters require the search to be interval type.
  // Maximum chunksize of the POST-request also changes. Interval search = 100, Point-like search = 1000.
  var cleanHeader = getCleanArrayElements(header);
  var intervalSearch = 'false'
  if (cleanHeader.includes('x_loppu') && cleanHeader.includes('y_loppu')) {
    intervalSearch = 'true'
  } else if (cleanHeader.includes('x') && cleanHeader.includes('y')) {
    intervalSearch = 'false';
  } else if (cleanHeader.includes('katunumero') || cleanHeader.includes('m_arvo')) {
    intervalSearch = 'false';
  } else if (cleanHeader.includes('katunimi') && cleanHeader.includes('kuntanimi')) {
    intervalSearch = 'true';
  } else if (cleanHeader.includes('osa_loppu')) {
    intervalSearch = 'true';
  } else if (cleanHeader.includes('tie') && cleanHeader.includes('etaisyys') && cleanHeader.includes('osa_loppu')) {
    intervalSearch = 'true';
  } else if (cleanHeader.includes('tie') && !cleanHeader.includes('etaisyys') && !cleanHeader.includes('osa_loppu')) {
    intervalSearch = 'true';
  } else if ((cleanHeader.includes('link_id') || cleanHeader.includes('kmtk_id')) && !cleanHeader.includes('m_arvo')) {
    intervalSearch = 'true';
  }
  return intervalSearch;
}


function setReturnParams(returnParamsString) {
  // Setting return values for VKM-requests
  let geomFormat;
  var validReturnParams;

  // This flag tells if coordinates parameter was chosen by the user.
  // true == show coordinates in conversion output, false == don't show coordinates in conversion output.
  // Either way, this parameter ('1') will be added if WKT or GPKG format is used.
  let showCoordinatesInOutput = false;

  // This flag is true if a user chose the return parameter that only outputs road address columns.
  let onlyRoadAddressInOutput = false;

  // Return parameters are not valid or are empty.
  if ([null, ' ', '', undefined, 'saveInput'].includes(returnParamsString)) {
    validReturnParams = RETURN_VALUES; // Includes coordinates parameter '1'.
    showCoordinatesInOutput = true;
    geomFormat = 'WKT';
  } else if (returnParamsString.includes('GPKG')) {
    let paramsArray = returnParamsString.split(',');
    let gpkgIndex = paramsArray.indexOf('GPKG');
    // Replace the custom return parameter with a valid VKM return parameter.
    paramsArray[gpkgIndex] = '5';
    showCoordinatesInOutput = ensureCoordinatesParameterIsIncluded(paramsArray);
    validReturnParams = joinReturnParamsArray(paramsArray)
    geomFormat = 'GPKG';
  } else if (returnParamsString.includes('5')) {
    let paramsArray = returnParamsString.split(',');
    showCoordinatesInOutput = ensureCoordinatesParameterIsIncluded(paramsArray);
    validReturnParams = joinReturnParamsArray(paramsArray)
    geomFormat = 'WKT';
  } else {
    validReturnParams = returnParamsString;
  }

  // Some custom VKM return values require modification or deletion.
  // Check if user chose "0" (road address only) as a return parameter.
  if (returnParamsString.includes('0')) {
    validReturnParams = modifyValueAtIndex(validReturnParams, valueToModify = '0', replaceValueWith = '2');
    onlyRoadAddressInOutput = true;
  }
  // Delete custom return property value.
  if (returnParamsString.includes('saveInput')) {
    validReturnParams = modifyValueAtIndex(validReturnParams, valueToModify = 'saveInput');
  }

  return {validReturnParams, geomFormat, showCoordinatesInOutput, onlyRoadAddressInOutput};
}


function joinReturnParamsArray(paramsArray) {
  if (paramsArray.length === 1) {
    return paramsArray[0];
  } else {
    return paramsArray.join(',')
  }
}


function modifyValueAtIndex(returnParamsString, valueToModify, replaceValueWith=undefined) {
  let paramsArray = returnParamsString.split(',');
  let valueIndex = paramsArray.indexOf(valueToModify);
  if (replaceValueWith) {
    paramsArray[valueIndex] = replaceValueWith;
  } else {
    if (valueIndex > -1) { // only splice array when item is found
      paramsArray.splice(valueIndex, 1); // 2nd parameter means remove one item only
    }
  }

  return joinReturnParamsArray(paramsArray)
}


function ensureCoordinatesParameterIsIncluded(paramsArray) {
  // This function shows if a user chose the parameter.
  // false = not chosen, true = chosen.

  // Ensure the parameter for coordinate points is included.
  if (paramsArray.includes('1')) {
    return true;
  } else {
    paramsArray.push('1');
    return false;
  }
}

async function convertValues(data) {
  let limitingParams = data.conversionParams.limitingParams;
  let returnParams = data.conversionParams.returnParams;

  let returnParamsResult = setReturnParams(returnParams);
  const validReturnParams = returnParamsResult.validReturnParams;
  const geomFormat = returnParamsResult.geomFormat;
  const showCoordinatesInOutput = returnParamsResult.showCoordinatesInOutput;
  const onlyRoadAddressInOutput = returnParamsResult.onlyRoadAddressInOutput;
  console.log('Converting values. ' + Date());
  console.log('Starting VKM conversions. ' + Date());
  let vkmResponses = await makeVkmRequest(data.vkmRows, VKM_URL, validReturnParams, limitingParams);
  console.log('VKM conversions done. ' + Date());
  let convertedData = await parseVkmResponse(vkmResponses, data.bonusRows, data.vkmRows);
  console.log('Converting values done. ' + Date());
  // Reformat and reorder GeoJSON features depending on the chosen geometry format
  let reformattedObjects = convertedData.vkmFeatures.map(obj => reformatFeature(obj, geomFormat, data.originalKeys, showCoordinatesInOutput, onlyRoadAddressInOutput));
  
  // Pass metadata and converted values to the returnable object (converted data)
  convertedData.newVkmObjects = reformattedObjects;
  convertedData.geomFormat = geomFormat;
  convertedData.conversionUuid = data.conversionUuid;
  convertedData.fileName = data.fileName;
  delete convertedData['vkmFeatures']; // Delete unneeded array
  return convertedData;
}


async function parseAndPushToArray(response, vkmFeatures, inputVkmObjects, errorMetadata) {
  let featureList = response.features;
  vkmFeatures.push(...filterErrorRows(featureList, inputVkmObjects, errorMetadata));
}


async function parseVkmResponse(vkmResponses, bonusObjects, inputVkmObjects) {
  console.log('Parsing VKM response. ' + Date());

  // Collect parsed VKM-features.
  var vkmFeatures = [];
  // Collect failed conversions.
  var errorMetadata = [];

  for (let response of vkmResponses) {
    await parseAndPushToArray(response, vkmFeatures, inputVkmObjects, errorMetadata);
  }
  
  let vkmObjectsLength = inputVkmObjects.length;
  inputVkmObjects = null; // Clear up memory
  vkmResponses = null; // Clear up memory

  await attatchBonusObjects(vkmFeatures, bonusObjects);
  console.log('Parsing VKM response done. ' + Date());
  return {vkmFeatures, errorMetadata, inputCount: vkmObjectsLength};
}


function filterErrorRows(featureList, inputVkmObjects, errorMetadata) {
  var objects = [];
  
  for (var feature of featureList) {
    try {
      checkFeatureForErrors(feature, errorMetadata, inputVkmObjects);
    }
    catch {
      continue;
    }
    objects.push(feature);
  }
  return objects;
}


function removeImproperIDKey(obj) {
  // Removes possible improper duplicate of the Tunniste-key: e.g. "  tUnnisTe". 
  let tunnisteValue;
  for (let key in obj) {
    if (key.toLowerCase().trim() === 'tunniste') {
      tunnisteValue = obj[key];
      if (key !== 'tunniste') {
        delete obj[key];
      }
      return tunnisteValue;
    }
  }
}


async function attatchBonusObjects(newVkmObjects, bonusObjects) {
  console.log('Attaching bonus objects. ' + Date());
  
  // Create a map for bonusObjects.
  var bonusMap = new Map();
  bonusObjects.forEach(obj => {
    var tunnisteValue = removeImproperIDKey(obj);
    if (tunnisteValue) {
      tunnisteValue = tunnisteValue.toString();
      bonusMap.set(tunnisteValue.trim().toLowerCase(), obj);
    } else {
      console.warn('Bonus object has no Tunniste-value!');
    }
  });

  for (var object of newVkmObjects) {
    await findAndAttatchBonusObject(object, bonusMap);
  }
  console.log('Attaching bonus objects done. ' + Date());
}


async function findAndAttatchBonusObject(object, bonusMap) {
  var vkmObjectId = object.properties.tunniste;
  // Find the matching bonus object for VKM-feature and attatch it.
  var matchingBonusObject = bonusMap.get(vkmObjectId.trim().toLowerCase());
  if (matchingBonusObject) {
    Object.assign(object.properties, matchingBonusObject);
  } else {
    console.warn('No matching bonus object found!');
  }
}


function checkFeatureForErrors(feature, errorMetadata, inputVkmObjects) {
  // Collects original VKM rows that caused an error.
  if ('virheet' in feature.properties) {
    var errorVkmObjects = R.filter(obj => obj.tunniste == feature.properties.tunniste, inputVkmObjects);
    errorVkmObjects.forEach(item => item['virheviesti'] = feature.properties.virheet);
    errorMetadata.push(...errorVkmObjects);
    throw new Error(feature.properties.virheet);
  }
}


function parseJSON(str) {
  return str.trim() ? JSON.parse(str) : {};
}


//*************** Build output

function reformatFeature(obj, geomFormat, originalKeys, showCoordinatesInOutput, onlyRoadAddressInOutput) {
  let newObject = {};
  let geometry = obj.geometry;
  let objectProperties = obj.properties;
  // For setting the direction of the first geometry line.
  let startingCoord = {
    'x' : obj.properties.x, 
    'y' : obj.properties.y
  };

  // Make sure the first line starts from the starting coordinates.
  correctFirstLineDirection(geometry, startingCoord)

  // Check if MultiLineString is continuous.
  ensureMultiLineStringIsContinuous(geometry);

  // Rorder object keys
  let newProperties = reorderProperties(objectProperties, originalKeys);

  // Delete coordinate values if they are not needed in the output.
  if (showCoordinatesInOutput == false) {
    deleteKeys(REMOVABLE_COORDINATE_KEYS, newProperties);
  }

  // Delete unnecessary VKM properties if user chose only road address values as output.
  if (onlyRoadAddressInOutput == true) {
    deleteKeys(REMOVABLE_VKM_KEYS_1, newProperties);
  }

  // Delete some other unnecessary VKM properties.
  deleteKeys(REMOVABLE_VKM_KEYS_2, newProperties);

  if (geomFormat == 'GPKG') {
    // Make sure that the new object is a GeoJSON feature like the original
    newObject = {
      "type" : "Feature",
      "geometry" : geometry,
      "properties" : newProperties
    };
  } else if (geomFormat == 'WKT') {
    // Insert geometry as WKT and convert the feature to a normal object with properties
    newProperties['geometry_wkt'] = stringify(geometry);
    newObject = newProperties;
  } else {
    newObject = newProperties;
  }
  return newObject;
}


function deleteKeys(keysToDelete, deleteFrom) {
  keysToDelete.forEach(key => delete deleteFrom[key]);
}


function correctFirstLineDirection(geometry, startingCoord) {
  if (!geometry || !geometry.type || !geometry.coordinates || !startingCoord || !startingCoord.x || !startingCoord.y) {
    return;
  }

  let lineString1;
  if (geometry.type == 'MultiLineString') {
    lineString1 = geometry.coordinates[0];
  } else if (geometry.type == 'LineString') {
    lineString1 = geometry.coordinates;
  } else {
    return;
  }
  
  let firstPointOfLineString1 = lineString1[0];
  let firstPointX = firstPointOfLineString1[0]
  let firstPointY = firstPointOfLineString1[1]

  // If the first line doesn't start from the coordinates, flip it.
  if (!(areNumbersClose(firstPointX, startingCoord.x) && areNumbersClose(firstPointY, startingCoord.y))) {
    lineString1 = lineString1.reverse();
  }
}


function areNumbersClose(num1, num2, epsilon = 0.01) {
  return Math.abs(num1 - num2) < epsilon;
}


function ensureMultiLineStringIsContinuous(geometry) {
  if (!geometry || !geometry.type || !geometry.coordinates || geometry.type !== 'MultiLineString') {
    return;
  }

  // Iterate over each LineString in the MultiLineString
  for (let i = 0; i < geometry.coordinates.length - 1; i++) {
    let lineString1 = geometry.coordinates[i];
    let lineString2 = geometry.coordinates[i + 1];

    // Get the last point of the current LineString and the first point of the next LineString
    let lastPointOfLineString1 = lineString1[lineString1.length - 1];
    let firstPointOfLineString2 = lineString2[0];

    // Check if the lines are continuous
    if (
      lastPointOfLineString1[0] !== firstPointOfLineString2[0] || 
      lastPointOfLineString1[1] !== firstPointOfLineString2[1] || 
      lastPointOfLineString1[2] !== firstPointOfLineString2[2]
    ) {
      // If the lines are not continuous, flip the next line
      lineString2 = lineString2.reverse();
      firstPointOfLineString2 = lineString2[0];

      // Check again if the lines are continuous after flipping
      if (
        lastPointOfLineString1[0] !== firstPointOfLineString2[0] || 
        lastPointOfLineString1[1] !== firstPointOfLineString2[1] || 
        lastPointOfLineString1[2] !== firstPointOfLineString2[2]
      ) {
        // If there's still a discontinuity after flipping, continue to the next LineString
        console.warn(`Lines still discontinuous after flipping!\nLast point of line 1: ${lastPointOfLineString1}\nFirst point of line 2: ${firstPointOfLineString2}\n`);
        continue;
      }
    }
  }
}


function reorderProperties(oldProperties, originalKeys) {
  let newProperties = {};

  // Translate back to the original syntax used by the user and instert the "interesting" VKM properties first, in certain order
  IMPORTANT_VKM_PROPERTIES_ORDER.forEach(vkmKey => {
    if (oldProperties.hasOwnProperty(vkmKey)) {
      let originalKey = originalKeys[vkmKey] || vkmKey;
      newProperties[originalKey] = oldProperties[vkmKey];
    }
  });
  // Inser the rest of the properties
  for (let key in oldProperties) {
    if (!newProperties.hasOwnProperty(key) && !newProperties.hasOwnProperty(originalKeys[key])) {
      newProperties[key] = oldProperties[key];
    }
  }
  return newProperties;
}


function buildGeojsonFeatureCollection(features) {
  let featureCollection = {
    "type" : "FeatureCollection",
    "features" : []
  };
  // Renaming original geometry fields in properties so they don't interfere with GeoJSON fields during GPKG-conversion
  for (let feature of features) {
    if ('geometry' in feature.properties) {
      feature.properties['geometry_original'] = feature.properties['geometry'];
      delete feature.properties['geometry'];
    }
    featureCollection.features.push(feature);
  }
  return featureCollection;
}


async function deleteFile(filePath) {
  // Deletes a file if it exists.
  try {
    await fs.access(filePath, fs.constants.F_OK);
    await fs.unlink(filePath);
    console.log(`File ${filePath} removed.`);
  } catch (err) {
    console.log(`File ${filePath} doesn't exist.`);
  }
}


// Function to output a file buffer object.
async function buildOutput(outputData) {
  console.log('Creating file buffers. ' + Date());

  // Original file name is used as the layer name in the GPKG file
  let layerName = outputData.fileName;

  let buffer = Buffer.alloc(0);
  let errorBuffer = Buffer.alloc(0);

  // Chunk size = how many rows should be converted at one time
  const CHUNK_SIZE = 5000;

  // Perform a GeoJSON–Geopackage conversion if the chosen geometry format is GPKG
  if (outputData.geomFormat == 'GPKG') {

    let featureCollection = buildGeojsonFeatureCollection(outputData.newVkmObjects);
    let jsonString = JSON.stringify(featureCollection);
    // Create UUID for the convertable file to correctly identify files
    let uuid = outputData.conversionUuid;
    
    // Create a folder if it doesn't exist
    var geojsonFolder = './lib/convertable_files';
    try {
      await fs.access(geojsonFolder, fs.constants.F_OK);
      console.log('convertable_files folder already exists');
    } catch (err) {
      await fs.mkdir(geojsonFolder);
    }

    // Create a unique json file
    var geojsonFile = `${geojsonFolder}/${uuid}.json`;
    try {
      await fs.writeFile(geojsonFile, jsonString, 'latin1');
      console.log(`File ${geojsonFile} created.`);
    } catch (err) {
      throw err;
    }

    try {
      // Convert the GeoJSON file into GPKG file.
      console.log('Executing GPKG conversion.');
      let { pythonOutput, pythonError } = await exec(`python3 ./lib/python_script.py "${uuid}" "${layerName}"`, { encoding: 'latin1'});

      // Read the created GPKG file into buffer
      var gpkgFile = `${geojsonFolder}/${uuid}.gpkg`;
      try {
        buffer = await fs.readFile(gpkgFile);
        console.log(`File ${gpkgFile} read into buffer.`);

        // Remove the files created during GeoJSON–GPKG conversion
        await deleteFile(geojsonFile);
        await deleteFile(gpkgFile);
      } catch (err) {
        // Remove the files created during GeoJSON–GPKG conversion
        await deleteFile(geojsonFile);
        await deleteFile(gpkgFile);
        throw err;
      }
    } catch (error) {
      console.error('GPKG conversion error:', error);
      // Remove the files created during GeoJSON–GPKG conversion
      await deleteFile(geojsonFile);
      await deleteFile(gpkgFile);
    }
  
  } else {
 
    // Process data in chunks using the ChunkProcessor.
    // Use chunkToCSV function to process each chunk.
    buffer = await processArray(outputData.newVkmObjects, CHUNK_SIZE, chunkToCSV);
  }

  // Process data in chunks using the ChunkProcessor.
  // Use chunkToCSV function to process each chunk.
  errorBuffer = await processArray(outputData.errorMetadata, CHUNK_SIZE, chunkToCSV);

  console.log('File buffers created. ' + Date());

  // Return the buffer and metadata
  return {
    buffer,
    errorBuffer,
    metadata: {
      outputCount: outputData.newVkmObjects.length,
      inputCount: outputData.inputCount,
      errorCount: outputData.errorMetadata.length,
      fileName: layerName
    }
  };
}


function chunkToCSV(chunk, isFirstChunk) {
  let wsRows;
  if (isFirstChunk) {
    // If it's the first chunk, include headers.
    wsRows = XLSX.utils.json_to_sheet(chunk);
  } else {
    // If it's not the first chunk, exclude headers.
    wsRows = XLSX.utils.json_to_sheet(chunk, {skipHeader: true});
  }
  let csvRows = XLSX.utils.sheet_to_csv(wsRows, {FS: ';'});
  // Add a newline character at the end of each chunk.
  csvRows += '\n';
  return csvRows;
}


async function processArray(array, chunkSize, processChunk) {
  const processor = new ChunkProcessor(array, chunkSize, processChunk);

  // Modifying the processChunk (=chunkToCSV) function to make sure only the first chunk contains the header row.
  let isFirstChunk = true;
  processor.processChunk = (chunk) => {
    const csvRows = processChunk(chunk, isFirstChunk);
    isFirstChunk = false;
    return csvRows;
  };

  // Processing the array in chunks.
  const result = await processor.processArrayInChunks();
  return result;
}