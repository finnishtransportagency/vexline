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

let jsonData;

// Initialize the current path
var currentPath = null; 

// ** Used on path cards (that shows your current path) ***

function updatePathIndicator() {
  // Get all the path indicator cards
  var pathCards = document.querySelectorAll('.path-card');

  // Loop through each path card
  pathCards.forEach(function (pathCard) {
    // Remove the 'active' class from all path cards
    pathCard.classList.remove('active');

    if (currentPath !== null && pathCard.getAttribute('data-path') === currentPath) {
      // Add the 'active' class to the current path card
      pathCard.classList.add('active');
    }
  });
}


function changePath(newPath) {
  currentPath = newPath;
  updatePathIndicator(); // Update the path indicator when the path changes
}

changePath("path1"); // Change to a different path


// *** Function for user guide pop-up *** 
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("myModal");
  const btns = Array.from(document.getElementsByClassName("user-guide-button"));
  const pages = ["kayttoohje", "versiotiedot", "yhteystiedot"];
  const buttons = ["btn-kayttoohje", "btn-versiotiedot", "btn-yhteystiedot"];

  const showSubPage = (index) => {
    const infopages = Array.from(document.querySelectorAll(".infopage"));
    infopages.forEach(infopage => infopage.style.display = "none");
    const activePage = document.getElementById(pages[index]);
    if (activePage) {
      activePage.style.display = "block";
    } else {
      console.error("Page element not found:", pages[index]);
    }
  }

  const setActiveButton = (index) => {
    const buttonElements = Array.from(document.querySelectorAll(".infobtn-container button"));
    buttonElements.forEach(button => button.classList.remove("active"));
    const activeButton = document.getElementById(buttons[index]);
    if (activeButton) {
      activeButton.classList.add("active");
    } else {
      console.error("Button element not found:", buttons[index]);
    }
  }

  const initializeButtons = () => {
    buttons.forEach((buttonId, index) => {
      const button = document.getElementById(buttonId);
      if (button) {
        button.onclick = () => {
          showSubPage(index);
          setActiveButton(index);
        }
      } else {
        console.error("Button not found during initialization:", buttonId);
      }
    });
  }

  if (btns.length > 0 && modal) {
    btns.forEach((btn, i) => {
      btn.onclick = () => {
        fetch('user-guide.html')
          .then(response => response.text())
          .then(data => {
            document.getElementById('content').innerHTML = data;
            initializeButtons();
            modal.style.display = "block";
            showSubPage(0);
            setActiveButton(0);

            const span = document.getElementsByClassName("close")[0];
            if (span) {
              span.onclick = () => {
                modal.style.display = "none";
                document.body.style.backgroundColor = "initial";
              }
            } else {
              console.error("Close button element not found");
            }
          })
          .catch(err => console.error("Error loading user guide:", err));
      }
    });

    window.onclick = (event) => {
      if (event.target == modal) {
        modal.style.display = "none";
        document.body.style.backgroundColor = "initial";
      }
    }
  } else {
    if (btns.length === 0) {
      console.error("User guide buttons not found.");
    }
    if (!modal) {
      console.error("Modal element not found.");
    }
  }
});


// *** Loads correct checkboxes depending which path user chooses ***
function loadCheckboxes(configName) {
  const checkboxesContainer = document.getElementById('palautusarvotContainer');
  checkboxesContainer.innerHTML = '';

  // Get the checkbox configuration based on the configName from jsonData
  const checkboxConfig = jsonData.checkboxConfigs[configName] || jsonData.checkboxConfigs.default;

  // Loop through the configuration and create checkboxes
  checkboxConfig.forEach(checkbox => {
      const checkboxDiv = document.createElement('div');
      checkboxDiv.className = 'checkbox';
      checkboxDiv.innerHTML = `
          <label>
              <input type="checkbox" value="${checkbox.value}">
              ${checkbox.label}
          </label>
      `;
      checkboxesContainer.appendChild(checkboxDiv);
  });
}

  
// *** Responses for file converting ***
document.addEventListener('DOMContentLoaded', function() {
  var fileName = window.location.hash.substring(1);
  if (fileName) { pollResponse(fileName); }

  var loader = document.getElementById("loading");
  var ready = document.getElementById("ready");

  function handleReady(fileName, res) {
    document.getElementById("downloadRows").setAttribute("href", downloadUrl(fileName)); // setAttribute() == attr() in jquery
    document.getElementById("downloadErrorRows").setAttribute("href", downloadErrorRowsUrl(fileName));
    loader.classList.add("hidden");
    ready.classList.remove("hidden");
    displayErrors(res);
  }; 


  function handlePending() {
    loader.classList.remove("hidden");
    ready.classList.add("hidden");
    document.getElementById("fileDetailsRed").style.display = "none"; // .hide() in jquery
    document.getElementById("fileDetailsGreen").style.display = "none";
    document.getElementById("fileDetailsYellow").style.display = "none";
    document.getElementById("downloadRows").style.display = "none";
    document.getElementById("downloadErrorRows").style.display = "none";
  }


  function handleError() {
    loader.classList.add("hidden");
    ready.classList.add("hidden");
  }


  function pollResponse(res, serverErrorCount = 0) {
    const errorLimit = 10;
    // Base delay time in milliseconds.
    const baseDelay = 5000;
    // Maximum delay.
    const maxDelay = 60000;

    // Display an error if server reaches a limit of retries after 50X code.
    if (serverErrorCount >= errorLimit) {
      handleError();
      var fileDetailsRed = document.getElementById("fileDetailsRed");
      fileDetailsRed.innerHTML = 'Virhe 500 - Sisäinen palvelinvirhe!';
      fileDetailsRed.style.display = "block";
        // Exit the function early.
      return;
    }
    
    const retryAfterError = () => {
      console.log('Retrying after 50X status code...');
      handlePending();
      // Calculate exponential delay.
      let delay = Math.min(maxDelay, Math.pow(2, serverErrorCount) * baseDelay);
      setTimeout(function() {
        pollResponse(res, serverErrorCount + 1);
      }, delay);
    }
    
    fetch(appPath + "/status/" + res)
      .then(async function(response) {
        return {body: await response.json(), status: response.status}; // Parse the JSON from the response
      })
      .then(function(responseJSON) {
        switch (responseJSON.status) {
          case 200:
            handleReady(res, responseJSON.body);
            break;
          case 202:
            handlePending();
            setTimeout(function() { pollResponse(res); }, 5000);
            break;
          case 400:
            // handleValidationError(responseJSON);
            showCorrespondingErrorMessage(responseJSON.body);
            break;
          case 404:
            handleError();
            document.getElementById("fileDetailsRed").innerHTML = 'Virhe 404 - Sivua ei löytynyt!';
            document.getElementById("fileDetailsRed").style.display = "block";
            break;
          case 500:
            handleError();
            document.getElementById("fileDetailsRed").innerHTML = 'Virhe 500 - Sisäinen palvelinvirhe!';
            document.getElementById("fileDetailsRed").style.display = "block";
            break;
          case 502:
          case 503:
          case 504:
            retryAfterError();
            break;
          default:
            console.error(`Unexpected status code ${responseJSON.status}`);
        }
      })
      .catch(function(error) {
        console.log('Fetch Error: ', error);
        retryAfterError();
      });
  }
    

  function showCorrespondingErrorMessage(response) {
    // The response from the server contains a responseJSON property that carries the error name.
    let errorType = response; 
    let fileDetailsRed = document.getElementById("fileDetailsRed");

    if (errorType === 'TunnisteError') {
      fileDetailsRed.innerHTML = 'Virhe 400 - Rivien "tunniste"-kentät puuttuvat tai eivät ole uniikkeja.';
    } else if (errorType === 'EmptyFieldsError') {
      fileDetailsRed.innerHTML = 'Virhe 400 - Pakolliset VKM-sarakkeet sisältävät tyhjiä kenttiä.';
    } else if (errorType === 'MissingParamsError') {
      fileDetailsRed.innerHTML = 'Virhe 400 - Pakolliset VKM-sarakkeet puuttuvat.';
    } else if (errorType === 'FileTypeError') {
      fileDetailsRed.innerHTML = 'Virhe 400 - Väärä tiedostomuoto.';
    } else if (errorType === 'InvalidParamsError') {
      fileDetailsRed.innerHTML = 'Virhe 400 - Asetetut rajaavat parametrit ovat viallisia.';
    } else {
      fileDetailsRed.innerHTML = 'Virhe 500 - Hallitsematon virhe!';
    }

    fileDetailsRed.style.display = "block";
  }


  // *** Functionality for page rendering *** 
  window.returnToPage = function(pageNumber) {
    localStorage.removeItem("dontShowFrontpage");
    goToPage(pageNumber);
  };


  window.goToPage = function(pageNumber) {

    let totalNumberOfPages = document.getElementsByClassName('page').length;
    // Hide all pages
    for (let i = 0; i <= totalNumberOfPages; i++) {
      let pageElement = document.getElementById('page' + i);
      if (pageElement) {
        pageElement.style.display = 'none';
      }
    }

    const storedValue = localStorage.getItem("dontShowFrontpage");

    if (storedValue === "true" && pageNumber === 0) {
      // Check if this is the first time the checkbox is checked
      const firstTimeChecked = localStorage.getItem("firstTimeChecked");
      if (firstTimeChecked !== "true") {
        localStorage.setItem("firstTimeChecked", "true");
      } else {
        // Stay on the current page and don't redirect
        return;
      }
    }

    // Show the requested page
    let requestedPageElement = document.getElementById('page' + pageNumber);
    if (requestedPageElement) {
      requestedPageElement.style.display = 'block';

      // If the user is navigating to page 4, start polling the server for the file conversion status
      if (pageNumber === 4) {
        var fileName = window.location.hash.substring(1);
        if (fileName) {
          pollResponse(fileName);
        }
      }

      // Check if this is page 2, and add the event listener for the "upload" form
      if (pageNumber === 2) {
        var uploadForm = document.getElementById('upload');
        if (uploadForm) {
          uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            // Handle the form submission logic here
          });
        } else {
          console.error('Upload form not found on page 2.');
        }
      }
    } else {
      console.error('Page ' + pageNumber + ' does not exist.');
    }
  };

  
  // *** Uploading file ***
  document.getElementById("upload").addEventListener("submit", function(event) {
    var fileInput = document.querySelector('input[type="file"]');
    if (!fileInput.value) {
      event.preventDefault();
      alert('Valitse tiedosto jatkaaksesi');
      return;
    }

    handlePending();

    let formData = new FormData(this);
    let checkedValues = getCheckedValues();
    let limitingParameters = getLimitingParameters();

    formData.append('checkedValues', checkedValues);
    formData.append('limits', limitingParameters);

    fetch(appPath + "/upload", {
      method: "POST",
      body: formData,
      cache: 'no-store'
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.text();
      })
      .then(res => {
        window.location.hash = res;
        // Server returns conversion metadata in its response.
        // Status checking begins.
        pollResponse(res);
      })
      .catch(handleError);
  });


  var fileInput = document.querySelector('input[type="file"]');
  fileInput.addEventListener('change', function(e) {
    var file = e.target.files[0];
    var fileContentDiv = document.getElementById('fileContent');
    fileContentDiv.innerText = file.name;
  });
    
  document.getElementById('upload').addEventListener('submit', function(e) {
    e.preventDefault();

    var file = fileInput.files[0];
    var reader = new FileReader();

    reader.onload = function(e) {
      var data = new Uint8Array(e.target.result);
      var workbook = XLSX.read(data, {type: 'array'});

      // Assuming your data is in the first sheet
      var worksheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // Convert your sheet to JSON
      var jsonData = XLSX.utils.sheet_to_json(worksheet, {header:1});
      
      // *** Display the file details ***  
      var fileDetailsDiv = document.getElementById('fileDetails');
      fileDetailsDiv.innerHTML = '<div style="display: flex; align-items: center;">' +
        '<div>' +
        '<b>Lähetetty tiedosto: </b>' +
        '<br>Tiedoston nimi: <b style="word-break: break-all;">' + file.name + '</b>' + 
        '<br>Tiedoston koko: <b>' + (file.size / 1024 / 1024).toFixed(2) + ' MB' + '</b>' +
        '<br>Tiedostomuoto: <b>' + file.type + '</b>' +
        '<br>Rivejä: <b>' + jsonData.length + '</b>' +
        '</div></div>';

      // Change to page 3 after displaying the file details
      goToPage(3);
    }; 

    reader.readAsArrayBuffer(file);
  });


  // *** Displays info of converted files or an error
  function displayErrors(res) {
    const hideElements = ids => ids.forEach(id => document.getElementById(id).style.display = 'none');
    const showElement = id => document.getElementById(id).style.display = 'block';

    const idsToHide = ['fileDetailsRed', 'fileDetailsGreen', 'fileDetailsYellow', 'downloadRows', 'downloadErrorRows'];
    hideElements(idsToHide);

    const filename = res.fileName;

    if (res.outputCount > 0) {
      console.log(res);
      document.getElementById('fileDetailsGreen').innerHTML = `<div style="display: flex; align-items: center;">
                                                                  <img src="images/file-solid.svg" alt="file" style="margin-right: 20px;">
                                                                  <div>
                                                                  Tiedostonimi: ${filename}
                                                                  <br>Rivejä: ${res.outputCount} kpl
                                                                  </div></div>`;
      showElement('fileDetailsGreen');
      showElement('downloadRows');
    }

    if (res.outputCount > 0) {
      console.log(res);
      document.getElementById('fileDetailsGreen').innerHTML = `<div style="display: flex; align-items: center;">
                                                                  <img src="images/file-solid.svg" alt="file" style="margin-right: 20px;">
                                                                  <div>
                                                                    Tiedostonimi: <b style="word-break: break-all;">${filename}</b><br>
                                                                    Rivejä: <b>${res.outputCount} kpl</b>
                                                                  </div>
                                                                </div>`;
      showElement('fileDetailsGreen');
      showElement('downloadRows');
    }
    
    if (res.errorCount > 0) {
      document.getElementById('fileDetailsYellow').innerHTML = `<div style="display: flex; align-items: center;">
                                                                    <img src="images/file-solid-black.svg" alt="file" style="margin-right: 20px;">
                                                                    <div>
                                                                      Tiedostonimi: <b style="word-break: break-all;">${filename}_ErrorRows.csv</b><br>
                                                                      Rivejä: <b>${res.errorCount} kpl</b>
                                                                    </div>
                                                                  </div>`;
      showElement('fileDetailsYellow');
      showElement('downloadErrorRows');
    }
    
  };


  function downloadUrl(fileName) {
    return "download/" + fileName;
  }


  function downloadErrorRowsUrl(fileName) {
    return "downloadError/" + fileName;
  }


  function getCheckedValues() {
    //console.log('Hello')
    let checkedValues = [];
    var checked = document.querySelectorAll("#palautusarvotContainer input[type=checkbox]:checked");
    for (let i = 0; i < checked.length; i++) {
      checkedValues.push(checked[i].value);
    }
    
    return checkedValues.join(',');
  }


  function getLimitingParameters() {
    //console.log('Hello')
    parameters = {};
    var allInputs = document.querySelectorAll("#tarkentavatArvotContainer input");
    for (let i = 0; i < allInputs.length; i++) {
      parameters[allInputs[i].name] = allInputs[i].value;
    }
    return JSON.stringify(parameters);
  }


  document.addEventListener("DOMContentLoaded", () => {
    const pages = ["kayttoohje", "versiotiedot", "yhteystiedot"];
    const buttons = ["btn-kayttoohje", "btn-versiotiedot", "btn-yhteystiedot"];
    let currentPageIndex = 0;

    const showSubPage = (index) => {
      const infopages = Array.from(document.querySelectorAll(".infopage"));
      infopages.forEach(infopage => infopage.style.display = "none");
      document.getElementById(pages[index]).style.display = "block";
    }

    const setActiveButton = (index) => {
      const buttonElements = Array.from(document.querySelectorAll(".infobtn-container button"));
      buttonElements.forEach(button => button.classList.remove("active"));
      document.getElementById(buttons[index]).classList.add("active");
    }

    // Show the first page initially
    showSubPage(currentPageIndex);
    setActiveButton(currentPageIndex);

    document.getElementById('btn-kayttoohje').addEventListener('click', () => {
      currentPageIndex = 0;
      showSubPage(currentPageIndex);
      setActiveButton(currentPageIndex);
    });

    document.getElementById('btn-versiotiedot').addEventListener('click', () => {
      currentPageIndex = 1;
      showSubPage(currentPageIndex);
      setActiveButton(currentPageIndex);
    });

    document.getElementById('btn-yhteystiedot').addEventListener('click', () => {
      currentPageIndex = 2;
      showSubPage(currentPageIndex);
      setActiveButton(currentPageIndex);
    });
  });

});
