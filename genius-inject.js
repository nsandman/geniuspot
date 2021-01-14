// Noah Sandman
// genius-inject.js
// Created 13 Jan 2021
// GeniuSpot

// format a JavaScript object
function formatGetParams(params) {
    return Object.keys(params)
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join("&");
}

// remove parentheses, split artists by ampersands, and add these all to a set
// getSpotifyId will search as many of these as needed to find a match
function generateSpotifySearchSets(trackJson) {
    let titleSet = new Set();
    let artistSet = new Set();

    titleSet.add(trackJson["title"]);
    titleSet.add(trackJson["title"].replace(/ *\([^)]*\) */g, ""));

    artistSet.add(trackJson["artist_display_name"]);
    const splitName = trackJson["artist_display_name"].split("&");
    for (partialName of splitName)
        artistSet.add(partialName.trim());

    return {
        "title": titleSet,
        "artists": artistSet
    };
}

// given an Apple Music track, will find the corresponding Spotify ID and call loadSpotifyPlayer
function mapIdAndLoad(clientId, clientSecret, trackJson, playerParent) {
    // sometimes there are issues with duplicates
    let replacedAlready = false;

    const searchSets = generateSpotifySearchSets(trackJson);
    for (artist of searchSets["artists"]) {
        if (replacedAlready)
            break;

        for (title of searchSets["title"]) {
            if (replacedAlready)
                break;

            const params = {
                "q": `${title} ${artist}`,
                "type": "track"
            };

            const req = new XMLHttpRequest();
            req.open("GET", `https://api.spotify.com/v1/search?${formatGetParams(params)}`);
            chrome.runtime.sendMessage(
                {
                    message: "getSpotifyToken",
                    clientId: clientId,
                    clientSecret: clientSecret
                }, 
                tokenResponse => {
                    if (!replacedAlready) {
                        req.setRequestHeader("Authorization", `${tokenResponse["token_type"]} ${tokenResponse["access_token"]}`);
                        req.send();
    
                        console.log(params["q"]);
                    }
                }
            );

            req.onreadystatechange = () => {
                if (req.readyState == 4 && req.status == 200 && !replacedAlready) {
                    const responseJson = JSON.parse(req.responseText);

                    try {
                        loadSpotifyPlayer(playerParent, responseJson["tracks"]["items"][0]["id"]);
                        replacedAlready = true;
                    }
                    catch (e) {
                        console.log("No tracks in Spotify response, received:");
                        console.log(req.responseText);
                    }
                }
            };
        }
    }
}

function loadSpotifyPlayer(playerParent, spotifyId) {
    // create the spotify embed iframe
    let frame = document.createElement("iframe");

    frame.style.height = "80px";
    frame.style.width = "calc(100% - 40px)";
    frame.style.marginLeft = "20px";

    frame.style.border = "2px solid black";
    frame.style.boxShadow = "0px 0px 21px 2px rgba(0,0,0,0.7)"

    frame.src = `https://open.spotify.com/embed/track/${spotifyId}`;
    frame.setAttribute("allow", "encrypted-media");
    frame.allowTransparency = true;

    // append and make sure our iframe is not crushed
    playerParent.appendChild(frame);
    playerParent.style.width = "100%";
}

function swapAppleMusicPlayer(clientId, clientSecret) {
    // this holds the iframe for the Apple Music player
    const appleMusicParent = document.getElementsByClassName("apple_music_player_iframe_wrapper")[0];
    
    // some pages do not have an Apple Music player, so they don't get Spotify
    if (appleMusicParent == undefined)
        return;

    // find the iframe (the apple music player)
    for (let i = 0; i < appleMusicParent.childNodes.length; i++) {
        const appleMusicIframe = appleMusicParent.childNodes[i];

        if (appleMusicIframe.nodeName == "IFRAME") {
            // we have to check and wait until the iframe's content is loaded to get the track metadata
            const contentPoll = setInterval(() => {
                if (appleMusicIframe.contentDocument != null) {
                    clearInterval(contentPoll);

                    const appleMusicPlayer = appleMusicIframe.contentDocument.querySelector("apple-music-player");

                    // the Apple Music track metadata is stored under this attribute
                    const trackJson = JSON.parse(appleMusicPlayer.getAttribute("preview_track"));

                    mapIdAndLoad(clientId, clientSecret, trackJson, appleMusicParent);
                    appleMusicParent.removeChild(appleMusicIframe);
                }
            }, 200);

            break;
        }
    }
}

// do all the above only after everything is loaded
document.addEventListener("readystatechange", event => {
    if (event.target.readyState === "complete") {
        chrome.storage.local.get("credentials", res => {
            try {
                const credentials = res["credentials"];
                swapAppleMusicPlayer(credentials["client_id"], credentials["client_secret"]);
            }
            catch (e) {} // do nothing if no credentials are saved
        });
    }
});
