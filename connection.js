const SERVER_URL = "http://localhost:5001";

function sendStudyData(data) {
  fetch(`${SERVER_URL}/saveStudyData`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ studyData: data }),
  })
    .then((response) => response.json())
    .then((data) => console.log("Server Response:", data))
    .catch((error) => console.error("Error sending data:", error));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveStudyData") {
    sendStudyData(request.data);
    sendResponse({ status: "Data Sent to Server" });
  }

  if (request.action === "getStudyData") {
    fetch(`${SERVER_URL}/getStudyData`)
      .then((response) => response.json())
      .then((data) => sendResponse({ studyData: data }))
      .catch((error) => console.error("Error fetching data:", error));

    return true;
  }
});
