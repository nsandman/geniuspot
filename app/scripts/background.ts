// Noah Sandman
// key-manager.ts
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
  const req = new XMLHttpRequest();
  req.open("POST", `https://accounts.spotify.com/api/token`);
  req.setRequestHeader("Authorization", `Basic ${genAuthBasicToken(clientId, clientSecret)}`);
  req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  req.send("grant_type=client_credentials"); 
  
  req.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
          const response = JSON.parse(this.responseText);
          response["saved_at"] = getEpochTimeSeconds();
          
          chrome.storage.local.set({
              "token": response
          }, 
          () => callback(response));
      }
  };
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
