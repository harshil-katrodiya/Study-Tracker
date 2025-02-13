const browser = window.browser || window.chrome;
const studyDomains = ['coursera.org', 'khanacademy.org'];

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && isStudySite(changeInfo.url)) {
        console.log(`User is on a study site: ${changeInfo.url}`);
    }
});

function isStudySite(url) {
    return studyDomains.some(domain => url.includes(domain));
}
