// Enable chromereload by uncommenting this line:
// import 'chromereload/devonly'

function populateFields(): void {
    chrome.storage.local.get("credentials", 
    function (res: {[name: string]: {[key: string]: string}}) {
        const credentials = res["credentials"];

        if (credentials != undefined) {
            const idField    : HTMLInputElement = document.getElementById("spot_id") as HTMLInputElement;
            const secretField: HTMLInputElement = document.getElementById("spot_secret") as HTMLInputElement;

            idField.value = credentials["client_id"];
            secretField.value = credentials["client_secret"];
        }
    });
}

function saveFields(): void {
    const clientId    : HTMLInputElement = document.getElementById("spot_id") as HTMLInputElement;
    const clientSecret: HTMLInputElement = document.getElementById("spot_secret") as HTMLInputElement;

    if (clientId && clientSecret) {
        chrome.storage.local.set({
            "credentials": {
                "client_id": clientId.value,
                "client_secret": clientSecret.value
            }
        }, 
        function() {
            const saveButton: HTMLButtonElement = document.getElementById("save") as HTMLButtonElement;
            saveButton.innerHTML = "SAVED";
        });
    }
}

function hideNote(id: string): void {
    const urlParams = new URLSearchParams(window.location.search);
    let idValue: string|null = urlParams.get(id);

    if (idValue != "1") {
        const note: HTMLElement = document.getElementById(id) as HTMLElement;
        note.style.display = "none";
    }
}

window.onload = function() {
    hideNote("note");
    populateFields();

    const saveButton: HTMLButtonElement = document.getElementById("save") as HTMLButtonElement;
    if (saveButton)
        saveButton.onclick = saveFields;
}
