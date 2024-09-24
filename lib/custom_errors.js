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

class MissingParamsError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MissingParamsError';
        Error.captureStackTrace(this, MissingParamsError);
    }
}


class InvalidParamsError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InvalidParamsError';
        Error.captureStackTrace(this, InvalidParamsError);
    }
}


class EmptyFieldsError extends Error {
    constructor(message) {
        super(message);
        this.name = 'EmptyFieldsError';
        Error.captureStackTrace(this, EmptyFieldsError);
    }
}


class TunnisteError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TunnisteError';
        Error.captureStackTrace(this, TunnisteError);
    }
}


class FileTypeError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FileTypeError';
        Error.captureStackTrace(this, FileTypeError);
    }
}
  
// Export the entire module.
module.exports = {
    TunnisteError,
    FileTypeError,
    MissingParamsError,
    EmptyFieldsError,
    InvalidParamsError
    // Add any other errors here.
  };
  