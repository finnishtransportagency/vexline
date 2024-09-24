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

class RowCounter {
    constructor() {
        this.counters = {};
    }

    // Create row counters for specified convertion process.
    initialize(uuid) {
        if (!this.counters[uuid]) {
            this.counters[uuid] = { 'inputRowCount' : 0, 'rowsConverted' : 0 };
        }
    }

    // Counts input rows to uniquely mark them if necessary.
    incrementInputRowCount(uuid) {
        this.counters[uuid].inputRowCount++;
    }

    // Counts input rows that were sent to VKM-API.
    incrementRowsConverted(uuid) {
        this.counters[uuid].rowsConverted++;
    }

    getInputRowCount(uuid) {
        return this.counters[uuid]['inputRowCount'];
    }

    getRowsConverted(uuid) {
        return this.counters[uuid]['rowsConverted'];
    }

    removeCounters(uuid) {
        this.counters[uuid] = undefined;
    }
}

// "New" keyword creates a new RowCounter object. This object can stay consistent across different modules it's imported into.
module.exports = new RowCounter();
