"""
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
"""

import sys
import json
import geopandas as gpd
from pathlib import Path
import pandas as pd
import re

# Function to check if a string can be a formatted date
def is_date_format(value):
    date_pattern = re.compile(r'^\d{1,2}\.\d{1,2}\.\d{4}$')  # Adjusted regex pattern
    return bool(date_pattern.match(value))

# Function to check if a string can be a decimal formatted with a comma
def is_decimal_comma_format(value):
    decimal_pattern = re.compile(r'^\d+,\d+$')
    return bool(decimal_pattern.match(value))

# Function to convert data types and handle formats
def convert_dtypes_and_format(gdf):
    for column in gdf.columns:
        valid_date_found = False
        if gdf[column].dtype == object:
            for i, val in gdf[column].items():
                if isinstance(val, str):
                    # Check and convert decimal comma format
                    if is_decimal_comma_format(val):
                        gdf.at[i, column] = val.replace(',', '.')
                    # Check and mark date format for conversion
                    elif is_date_format(val):
                        valid_date_found = True
                    
            try:
                gdf[column] = pd.to_numeric(gdf[column], errors='ignore')
            except ValueError:
                pass
            
            # Convert a column to datetime format if it meets the requirements
            if valid_date_found and 'pvm' in column.lower():
                try:
                    gdf[column] = pd.to_datetime(gdf[column], format='%d.%m.%Y', errors='coerce')
                except ValueError:
                    pass

    return gdf

# Read and parse GeoJSON file
def main(file_uuid, file_name):
    file_dir = Path('lib/convertable_files')
    file_path = f'{file_dir}/{file_uuid}'

    with open(f'{file_path}.json', 'r', encoding='latin1') as file:
        geojson = json.load(file)

    gdf = gpd.GeoDataFrame.from_features(geojson)
    # Rename original FID-values so they don't interfere with GPKG creation
    gdf = gdf.rename(columns={'FID': 'FID_original'})
    # Create new FID for each feature (=row)
    gdf['FID'] = range(1, len(gdf) + 1)
    gdf.crs = "EPSG:3067"

    # Convert data types and format
    gdf = convert_dtypes_and_format(gdf)

    # Save to GeoPackage
    gdf.to_file(f'{file_path}.gpkg', layer=file_name, driver='GPKG', encoding='latin1')
    print(f'File {file_path}.gpkg created.')

if __name__ == "__main__":
    file_uuid = sys.argv[1]
    file_name = sys.argv[2]
    main(file_uuid, file_name)
