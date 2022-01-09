// Noah Sandman
// background.ts
// Created 13 Jan 2021
// GeniuSpot

// Enable chromereload by uncommenting this line:
// import 'chromereload/devonly'

// "clientId:clientSecret", base64 encoded
function genAuthBasicToken(clientId: string, clientSecret: string): string {
  return btoa(`${clientId}:${clientSecret}`);
}


// get epoch time in seconds because Spotify gives key validity in seconds
function getEpochTimeSeconds(): number {
  return Math.floor(Date.now() / 1000);
}


// get a new access token from spotify with our credentials
function fetchSpotifyToken(clientId: string, clientSecret: string, callback: (response: object) => void) : void {
    fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Authorization": `Basic ${genAuthBasicToken(clientId, clientSecret)}`,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=client_credentials"
    })
    .then(resObj => resObj.json())
    .then(response => {
        response["saved_at"] = getEpochTimeSeconds();
        chrome.storage.local.set({
            "token": response
        }, 
        () => callback(response));
    })
    .catch(err => {
        console.error(err);
    });
}


// receive messages from content script
function messageListener(chromeRequest: {[name: string]: any}, _sender: any, sendResponse: (token: object) => void) {
  switch (chromeRequest["message"]) {
      case "getSpotifyToken": {
          chrome.storage.local.get("token", res => {
              const token = res["token"];                    

              try {
                  const now: number = getEpochTimeSeconds();

                  if ((token["saved_at"] + token["expires_in"]) > now) {
                      // valid token in cache
                      sendResponse(token);
                  }
                  else {
                      // token expired
                      fetchSpotifyToken(chromeRequest["clientId"], chromeRequest["clientSecret"], sendResponse);
                  }
              }
              catch (e) {
                  // no token in cache at all
                  fetchSpotifyToken(chromeRequest["clientId"], chromeRequest["clientSecret"], sendResponse);
              }
          });
          
          return true;
      }

      default:
          return false;
  }
}
chrome.runtime.onMessage.addListener(messageListener);


// show setup page on install
chrome.runtime.onInstalled.addListener(function() {
    chrome.tabs.create({
      url: chrome.runtime.getURL("pages/popup.html?note=1"),
      active: true
    });

    return false;
});