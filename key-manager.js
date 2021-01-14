// Noah Sandman
// key-manager.js
// Created 13 Jan 2021
// GeniuSpot

// <clientId:clientSecret> base64 encoded
function getAuthBasicToken(clientId, clientSecret) {
    return btoa(`${clientId}:${clientSecret}`);
}

// get epoch time in seconds because Spotify gives key validity in seconds
function getEpochTimeSeconds() {
    return parseInt(Date.now() / 1000);
}

// get a new access token from spotify with our credentials
function fetchSpotifyToken(clientId, clientSecret, callback) {
    const req = new XMLHttpRequest();
    req.open("POST", `https://accounts.spotify.com/api/token`);
    req.setRequestHeader("Authorization", `Basic ${getAuthBasicToken(clientId, clientSecret)}`);
    req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    req.send("grant_type=client_credentials"); 
    
    req.onreadystatechange = () => {
        if (req.readyState == 4 && req.status == 200) {
            const response = JSON.parse(req.responseText);
            response["saved_at"] = getEpochTimeSeconds();
            
            chrome.storage.local.set({
                "token": response
            }, 
            () => callback(response));
        }
    };
}

// receive messages from content script
chrome.runtime.onMessage.addListener(
    function(chromeRequest, _sender, sendResponse){
        switch (chromeRequest["message"]) {
            case "getSpotifyToken": {
                chrome.storage.local.get("token", res => {
                    const token = res["token"];                    

                    try {
                        const now = getEpochTimeSeconds();

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
);
