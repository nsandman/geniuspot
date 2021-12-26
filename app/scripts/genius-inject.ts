// Noah Sandman
// genius-inject.ts
// Created 13 Jan 2021
// GeniuSpot

// format a JavaScript object
function formatGetParams(params: {[name: string]: any}): string {
    return Object.keys(params)
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join("&");
}

// remove parentheses, split artists by ampersands, and add these all to a set
// getSpotifyId will search as many of these as needed to find a match
function generateSpotifySearchSets(trackJson: {[name: string]: any}): {[name: string]: Set<string>} {
    let titleSet: Set<string> = new Set();
    let artistSet: Set<string> = new Set();

    titleSet.add(trackJson["title"]);
    titleSet.add(trackJson["title"].replace(/ *\([^)]*\) */g, ""));

    artistSet.add(trackJson["artist_display_name"]);
    const splitName: [string] = trackJson["artist_display_name"].split("&");
    for (const partialName of splitName)
        artistSet.add(partialName.trim());

    return {
        "title": titleSet,
        "artists": artistSet
    };
}

// given an Apple Music track, will find the corresponding Spotify ID and call loadSpotifyPlayer
function mapIdAndLoad(clientId: string, clientSecret: string, trackJson: {[name: string]: any}, playerParent: HTMLElement, newSite: boolean): void {
    // sometimes there are issues with duplicates
    let replacedAlready = false;

    const searchSets = generateSpotifySearchSets(trackJson);
    for (const artist of searchSets["artists"]) {
        if (replacedAlready)
            break;

        for (const title of searchSets["title"]) {
            if (replacedAlready)
                break;

            const params = {
                "q": `${title} ${artist}`,
                "type": "track"
            };

            chrome.runtime.sendMessage(
                {
                    message: "getSpotifyToken",
                    clientId: clientId,
                    clientSecret: clientSecret
                }, 
                token => {
                    if (!replacedAlready) {
                        fetch(`https://api.spotify.com/v1/search?${formatGetParams(params)}`, {
                            method: "GET",
                            headers: {
                                "Authorization": `${token["token_type"]} ${token["access_token"]}`
                            }
                        })
                        .then(resObj => resObj.json())
                        .then(response => {
                            try {
                                loadSpotifyPlayer(playerParent, response["tracks"]["items"][0]["id"], newSite);
                                replacedAlready = true;
                            }
                            catch (e) {
                                console.log("No tracks in Spotify response, received:");
                                console.dir(response);
                            }
                        });
                    }
                }
            );
        }
    }
}


function loadSpotifyPlayer(playerParent: HTMLElement, spotifyId: string, newSite: boolean): void {
    // create the spotify embed iframe
    let frame: HTMLIFrameElement = document.createElement("iframe");

    frame.style.height = "80px";
    frame.style.width = "calc(100% - 40px)";
    frame.style.marginLeft = "20px";

    frame.style.border = "2px solid black";
    frame.style.boxShadow = "0px 0px 21px 2px rgba(0,0,0,0.7)"

    frame.src = `https://open.spotify.com/embed/track/${spotifyId}`;
    frame.setAttribute("allow", "encrypted-media");
    frame.setAttribute("allowtransparency", "true");

    // append and make sure our iframe is not crushed
    playerParent.appendChild(frame);
    playerParent.style.display = "block";
    if (newSite) {
        playerParent.style.width = "70%";
        playerParent.style.marginLeft = "15%";
    }
    else {
        playerParent.style.width = "100%";
    }
}


function swapAppleMusicPlayer(clientId: string, clientSecret: string): void {
    let newSite: boolean = false;

    // this holds the iframe for the Apple Music player
    let appleMusicParent: HTMLDivElement = (document.getElementsByClassName("apple_music_player_iframe_wrapper")[0] as HTMLDivElement);  
            
    // on the new site, the container div has a different name
    if (appleMusicParent == undefined) {
        appleMusicParent = document.getElementsByClassName("AppleMusicPlayer__IframeWrapper-uavgzr-1")[0] as HTMLDivElement;
        newSite = true;
    }
    
    // some pages do not have an Apple Music player, so they don't get Spotify. if the container
    //  is still undefined after trying both possibilities then we can assume there is no player
    if (appleMusicParent == undefined)
        return;

    // find the iframe (the apple music player)
    for (let i = 0; i < appleMusicParent.childNodes.length; i++) {
        const appleMusicIframe: HTMLIFrameElement = appleMusicParent.childNodes[i] as HTMLIFrameElement;

        if (appleMusicIframe.nodeName == "IFRAME") {
            // we have to check and wait until the iframe's content is loaded to get the track metadata
            const contentPoll = setInterval(() => {
                if (appleMusicIframe.contentDocument != null) {
                    clearInterval(contentPoll);

                    const appleMusicPlayer: HTMLElement = appleMusicIframe.contentDocument.querySelector("apple-music-player") as HTMLElement;

                    // the Apple Music track metadata is stored under this attribute
                    const previewJson: string | null = appleMusicPlayer.getAttribute("preview_track");
                    if (previewJson != null) {
                        const trackJson: {[name: string]: any} = JSON.parse(previewJson);

                        mapIdAndLoad(clientId, clientSecret, trackJson, appleMusicParent, newSite);
                        appleMusicParent.removeChild(appleMusicIframe);
                    }
                }
            }, 200);

            break;
        }
    }
}


// do all the above only after everything is loaded
document.addEventListener("readystatechange", function(event) {
    const target: Document = event.target as Document;

    if (target?.readyState === "complete") {
        chrome.storage.local.get("credentials", res => {
            try {
                const credentials = res["credentials"];
                swapAppleMusicPlayer(credentials["client_id"], credentials["client_secret"]);
            }
            catch (e) {} // do nothing if no credentials are saved
        });
    }
});
