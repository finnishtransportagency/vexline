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

class ChunkProcessor {
    
    // Process an array in chunks using setImmediate to let event-loop handle I/O-operations in between.
    // --> Makes NodeJS server more responsive during processing of large arrays.
    constructor(array, chunkSize, processChunk) {
        this.array = array;
        this.chunkSize = chunkSize;
        this.processChunk = processChunk;
        this.index = 0;
        this.resultBuffer = Buffer.alloc(0);
    }


    async processChunkAtIndex() {
        // Process a chunk at an index and increment the index.

        // Slice the chunk.
        const chunk = this.array.slice(this.index, this.index + this.chunkSize);
        const processedChunk = await this.processChunk(chunk);
        // Add the processedChunk to resultBuffer.
        this.resultBuffer = Buffer.concat([this.resultBuffer, Buffer.from(processedChunk, 'latin1')]);
        // Move the index by chunkSize.
        this.index += this.chunkSize;
    }


    async processNextChunk(resolve, reject) {
        // Process each chunk.
        // If there are more items left, schedule the next process with setImmediate(), 
        // else call the resolve() to resolve the Promise created in processArrayInChunks().
        try {
            await this.processChunkAtIndex();
            if (this.index < this.array.length) {
                setImmediate(() => this.processNextChunk(resolve, reject));
            } else {
                resolve();
            }
        } catch (error) {
            reject(error);
        }
    }


    async processArrayInChunks() {
        // Return resultBuffer once all chunks are processed.
        return new Promise((resolve, reject) => {
            this.processNextChunk(() => resolve(this.resultBuffer), reject);
        });
    }
}

module.exports = ChunkProcessor;
