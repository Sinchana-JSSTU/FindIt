
let reportType = "";
let allReports = [];
let allClaims = {};
let currentUser = null;

const auth = firebase.auth();
const db = firebase.firestore();

// ======================================
// HTML ELEMENTS
// ======================================

const lostBtn = document.getElementById("lostBtn");
const foundBtn = document.getElementById("foundBtn");
const viewBtn = document.getElementById("viewBtn");

const reportPanel = document.getElementById("reportPanel");
const closePanel = document.getElementById("closePanel");
const formTitle = document.getElementById("formTitle");
const reportForm = document.getElementById("reportForm");

const itemContainer = document.getElementById("itemContainer");
const matchContainer = document.getElementById("matchContainer");

const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const statusFilter = document.getElementById("statusFilter");

// ======================================
// CLAIM SECTION
// ======================================

let claimContainer = document.getElementById("claimContainer");

if (!claimContainer && matchContainer) {
    claimContainer = document.createElement("div");
    claimContainer.id = "claimContainer";

    matchContainer.parentNode.insertBefore(
        claimContainer,
        matchContainer.nextSibling
    );
}

// ======================================
// PRIVATE CHAT ELEMENTS
// ======================================

const chatList = document.getElementById("chatList");
const chatWindow = document.getElementById("chatWindow");
const chatHeader = document.getElementById("chatHeader");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

let currentChatId = null;
let stopMessagesListener = null;

// ======================================
// FINDIT NOTIFICATIONS
// ======================================

const notificationList =
    document.getElementById("notificationList");

const notificationBadge =
    document.getElementById("notificationBadge");

let allNotifications = [];

let notificationMessageListeners = {};

let previousClaimStates = {};

let notificationStorageKey = "";

// Load notifications for current user
function loadNotifications() {
    if (!currentUser) return;

    notificationStorageKey =
        "findit_notifications_" + currentUser.uid;

    try {
        const saved = JSON.parse(
            localStorage.getItem(notificationStorageKey) || "[]"
        );

        allNotifications = Array.isArray(saved) ? saved : [];

    } catch (error) {
        console.error("Notification loading error:", error);
        allNotifications = [];
    }

    renderNotifications();
}

// Save notifications
function saveNotifications() {
    if (!currentUser || !notificationStorageKey) return;

    try {
        localStorage.setItem(
            notificationStorageKey,
            JSON.stringify(allNotifications)
        );

    } catch (error) {
        console.error("Notification saving error:", error);
    }
}

// Add a new notification
function addNotification(
    id,
    title,
    message,
    type,
    claimId = "",
    time = null
) {
    const existing = allNotifications.some(
        notification => notification.id === id
    );

    if (existing) return;

    allNotifications.push({
        id: id,
        title: title,
        message: message,
        type: type,
        claimId: claimId,
        timeMs: time?.toDate
            ? time.toDate().getTime()
            : Date.now(),
        read: false
    });

    saveNotifications();
    renderNotifications();
}

// Display notifications
function renderNotifications() {
    if (!notificationList) return;

    allNotifications.sort(function (a, b) {
        return b.timeMs - a.timeMs;
    });

    notificationList.innerHTML = "";

    if (allNotifications.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No notifications yet.";
        notificationList.appendChild(empty);
    }

    allNotifications.forEach(function (notification) {
        const card = document.createElement("div");

        card.className =
            "notification-card " +
            (notification.read ? "read" : "unread");

        const heading = document.createElement("h3");
        heading.textContent = notification.title;

        const message = document.createElement("p");
        message.textContent = notification.message;

        const time = document.createElement("small");
        time.className = "notification-time";

        time.textContent = new Date(
            notification.timeMs
        ).toLocaleString();

        card.append(heading, message, time);

        card.addEventListener("click", function () {
            notification.read = true;

            saveNotifications();
            renderNotifications();

            if (notification.type === "chat") {
                document.getElementById("chatSection")
                    ?.scrollIntoView({ behavior: "smooth" });

                const claim = allClaims[notification.claimId];

                if (claim) {
                    openChat(notification.claimId, claim);
                }

            } else {
                claimContainer?.scrollIntoView({
                    behavior: "smooth"
                });
            }
        });

        notificationList.appendChild(card);
    });

    const unreadCount = allNotifications.filter(
        notification => !notification.read
    ).length;

    if (notificationBadge) {
        notificationBadge.textContent = unreadCount;

        notificationBadge.style.display =
            unreadCount > 0 ? "inline-flex" : "none";
    }
}

// ======================================
// REPORT FORM
// ======================================

// Open Lost report form
if (lostBtn) {
    lostBtn.addEventListener("click", function () {
        reportType = "Lost";
        formTitle.textContent = "Report Lost Item";
        reportPanel.classList.add("active");
    });
}

// Open Found report form
if (foundBtn) {
    foundBtn.addEventListener("click", function () {
        reportType = "Found";
        formTitle.textContent = "Report Found Item";
        reportPanel.classList.add("active");
    });
}

// Close report form
if (closePanel) {
    closePanel.addEventListener("click", function () {
        reportPanel.classList.remove("active");
    });
}

// View recent items
if (viewBtn) {
    viewBtn.addEventListener("click", function () {
        document.getElementById("recent")
            ?.scrollIntoView({ behavior: "smooth" });
    });
}

// ======================================
// SUBMIT REPORT
// ======================================

if (reportForm) {
    reportForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!currentUser) {
            alert("Please wait. Connecting to FindIt...");
            return;
        }

        const itemName =
            document.getElementById("itemName").value.trim();

        const category =
            document.getElementById("category").value;

        const location =
            document.getElementById("location").value.trim();

        const itemDate =
            document.getElementById("itemDate").value;

        const description =
            document.getElementById("description").value.trim();

        if (!reportType) {
            alert("Please select Lost or Found first.");
            return;
        }

        if (
            !itemName ||
            !category ||
            !location ||
            !itemDate ||
            !description
        ) {
            alert("Please fill in all required fields.");
            return;
        }

        try {
            await db.collection("reports").add({
                itemName: itemName,
                category: category,
                location: location,
                itemDate: itemDate,
                description: description,
                status: reportType,
                ownerUid: currentUser.uid,
                photoURL: "",
                createdAt:
                    firebase.firestore.FieldValue.serverTimestamp()
            });

            alert(reportType + " item reported successfully!");

            reportForm.reset();
            reportPanel.classList.remove("active");
            reportType = "";

        } catch (error) {
            console.error("Report submission error:", error);

            alert(
                "Could not submit report: " + error.message
            );
        }
    });
}

// ======================================
// TEXT SIMILARITY
// ======================================

function normalizeText(text) {
    return String(text || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ");
}

function editSimilarity(first, second) {
    const a = normalizeText(first);
    const b = normalizeText(second);

    if (!a || !b) return 0;
    if (a === b) return 1;

    const matrix = [];

    for (let i = 0; i <= a.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= b.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost =
                a[i - 1] === b[j - 1] ? 0 : 1;

            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    return 1 - matrix[a.length][b.length] /
        Math.max(a.length, b.length);
}

// Phonetic comparison
function soundCode(word) {
    const text = normalizeText(word).replace(/\s/g, "");

    if (!text) return "";

    const first = text[0];

    const groups = {
        b: "1", f: "1", p: "1", v: "1",
        c: "2", g: "2", j: "2", k: "2",
        q: "2", s: "2", x: "2", z: "2",
        d: "3", t: "3",
        l: "4",
        m: "5", n: "5",
        r: "6"
    };

    let result = first;
    let previous = groups[first] || "";

    for (
        let i = 1;
        i < text.length && result.length < 4;
        i++
    ) {
        const code = groups[text[i]] || "";

        if (code && code !== previous) {
            result += code;
        }

        previous = code;
    }

    return result.padEnd(4, "0");
}

function nameSimilarity(first, second) {
    const a = normalizeText(first);
    const b = normalizeText(second);

    if (!a || !b) return 0;
    if (a === b) return 1;

    const spelling = editSimilarity(a, b);

    const firstWords = a.split(" ");
    const secondWords = b.split(" ");

    let phonetic = 0;

    for (const wordA of firstWords) {
        let best = 0;

        for (const wordB of secondWords) {
            if (soundCode(wordA) === soundCode(wordB)) {
                best = 1;
            } else {
                best = Math.max(
                    best,
                    editSimilarity(wordA, wordB)
                );
            }
        }

        phonetic += best;
    }

    phonetic = phonetic /
        Math.max(firstWords.length, secondWords.length);

    return Math.max(spelling, phonetic * 0.85);
}

function textSimilarity(first, second) {
    const a = normalizeText(first);
    const b = normalizeText(second);

    if (!a || !b) return 0;
    if (a === b) return 1;

    return editSimilarity(a, b);
}

function calculateMatch(lost, found) {
    const nameScore = nameSimilarity(
        lost.itemName,
        found.itemName
    );

    if (nameScore < 0.30) return null;

    const categoryScore =
        normalizeText(lost.category) ===
        normalizeText(found.category) ? 1 : 0;

    const locationScore = textSimilarity(
        lost.location,
        found.location
    );

    const descriptionScore = textSimilarity(
        lost.description,
        found.description
    );

    const total =
        nameScore * 70 +
        categoryScore * 10 +
        locationScore * 10 +
        descriptionScore * 10;

    if (total < 20) return null;

    return {
        name: Math.round(nameScore * 100),
        total: Math.round(total)
    };
}

// ======================================
// DISPLAY RECENT REPORTS
// ======================================

function renderReports() {
    if (!itemContainer) return;

    const search = normalizeText(
        searchInput?.value || ""
    );

    const category = categoryFilter?.value || "";
    const status = statusFilter?.value || "";

    const filtered = allReports.filter(function (report) {
        if (report.returned === true) return false;

        const searchableText = normalizeText(
            report.itemName + " " +
            report.location + " " +
            report.description
        );

        return (
            searchableText.includes(search) &&
            (!category || report.category === category) &&
            (!status || report.status === status)
        );
    });

    if (filtered.length === 0) {
        itemContainer.innerHTML = "<p>No items found.</p>";
        return;
    }

    itemContainer.innerHTML = "";

    filtered.forEach(function (report) {
        const card = document.createElement("div");
        card.className = "item-card";

        const heading = document.createElement("h3");
        heading.textContent = report.itemName;

        const statusText = document.createElement("p");
        statusText.textContent = "Status: " + report.status;

        const categoryText = document.createElement("p");
        categoryText.textContent =
            "Category: " + report.category;

        const locationText = document.createElement("p");
        locationText.textContent =
            "Location: " + report.location;

        const dateText = document.createElement("p");
        dateText.textContent = "Date: " + report.itemDate;

        const descriptionText = document.createElement("p");
        descriptionText.textContent =
            "Description: " + report.description;

        card.append(
            heading,
            statusText,
            categoryText,
            locationText,
            dateText,
            descriptionText
        );

        itemContainer.appendChild(card);
    });
}

// ======================================
// CLAIM REQUEST
// ======================================

async function createClaimRequest(lost, found) {
    if (!currentUser) {
        alert("Please wait for Firebase connection.");
        return;
    }

    if (lost.ownerUid !== currentUser.uid) {
        alert("Only the Lost item owner can send this request.");
        return;
    }

    if (found.ownerUid === currentUser.uid) {
        alert("You cannot claim your own Found report.");
        return;
    }

    if (lost.returned === true || found.returned === true) {
        alert("This item has already been returned.");
        return;
    }

    const claimId = lost.id + "_" + found.id;
    const claimRef = db.collection("claims").doc(claimId);

    try {
        await claimRef.set({
            lostReportId: lost.id,
            foundReportId: found.id,
            lostOwnerUid: lost.ownerUid,
            foundOwnerUid: found.ownerUid,
            requesterUid: currentUser.uid,
            lostOwnerApproved: false,
            foundOwnerApproved: false,
            status: "Pending",
            createdAt:
                firebase.firestore.FieldValue.serverTimestamp()
        });

        alert(
            "Claim request sent successfully! You can now use Private Chat."
        );

    } catch (error) {
        console.error("Claim request error:", error);

        alert(
            "Could not send claim request: " +
            error.message +
            "\n\nPlease check Firestore Rules."
        );
    }
}

// ======================================
// HIDE RETURNED REPORTS
// ======================================

async function hideReturnedReports(claimId, claim) {
    if (
        !currentUser ||
        !claim ||
        claim.status !== "Returned"
    ) {
        return;
    }

    if (
        currentUser.uid !== claim.lostOwnerUid &&
        currentUser.uid !== claim.foundOwnerUid
    ) {
        return;
    }

    try {
        const reportIds = [
            claim.lostReportId,
            claim.foundReportId
        ];

        for (const reportId of reportIds) {
            if (!reportId) continue;

            const reportRef =
                db.collection("reports").doc(reportId);

            const reportSnapshot = await reportRef.get();

            if (!reportSnapshot.exists) continue;

            const report = reportSnapshot.data();

            if (report.returned === true) continue;

            await reportRef.update({
                returned: true,
                claimId: claimId
            });
        }

        console.log("Returned reports hidden successfully.");

    } catch (error) {
        console.error(
            "Could not hide returned reports:",
            error
        );
    }
}

// ======================================
// APPROVE CLAIM
// ======================================

async function approveClaim(claimId) {
    if (!currentUser) return;

    try {
        const claimRef =
            db.collection("claims").doc(claimId);

        const snapshot = await claimRef.get();

        if (!snapshot.exists) {
            alert("Claim request not found.");
            return;
        }

        const claim = snapshot.data();

        if (claim.status === "Returned") {
            alert("This item has already been returned.");

            await hideReturnedReports(claimId, claim);
            return;
        }

        const updates = {};

        if (
            currentUser.uid === claim.lostOwnerUid &&
            !claim.lostOwnerApproved
        ) {
            updates.lostOwnerApproved = true;

        } else if (
            currentUser.uid === claim.foundOwnerUid &&
            !claim.foundOwnerApproved
        ) {
            updates.foundOwnerApproved = true;

        } else {
            alert(
                "You have already approved this claim or cannot approve it."
            );
            return;
        }

        const lostApproved =
            updates.lostOwnerApproved === true ||
            claim.lostOwnerApproved;

        const foundApproved =
            updates.foundOwnerApproved === true ||
            claim.foundOwnerApproved;

        if (lostApproved && foundApproved) {
            updates.status = "Returned";
        }

        await claimRef.update(updates);

        if (updates.status === "Returned") {
            const updatedClaim = {
                ...claim,
                ...updates
            };

            await hideReturnedReports(
                claimId,
                updatedClaim
            );

            alert(
                "Both students confirmed! The item is marked as returned, and both reports have been hidden."
            );

        } else {
            alert(
                "Your confirmation has been recorded. Waiting for the other student."
            );
        }

    } catch (error) {
        console.error("Claim approval error:", error);

        alert(
            "Could not update claim: " + error.message
        );
    }
}

// ======================================
// DISPLAY CLAIM REQUESTS
// ======================================

function renderClaimRequests() {
    if (!claimContainer || !currentUser) return;

    claimContainer.innerHTML = "<h2>Claim Requests</h2>";

    const claims = Object.entries(allClaims);

    if (claims.length === 0) {
        claimContainer.innerHTML +=
            "<p>No claim requests yet.</p>";
        return;
    }

    claims.forEach(function ([claimId, claim]) {
        const card = document.createElement("div");
        card.className = "item-card";

        const heading = document.createElement("h3");
        heading.textContent = "Claim Request";

        const status = document.createElement("p");
        status.textContent = "Status: " + claim.status;

        const lostApproval = document.createElement("p");

        lostApproval.textContent =
            "Lost item owner: " +
            (claim.lostOwnerApproved
                ? "Approved"
                : "Waiting");

        const foundApproval = document.createElement("p");

        foundApproval.textContent =
            "Found item owner: " +
            (claim.foundOwnerApproved
                ? "Approved"
                : "Waiting");

        card.append(
            heading,
            status,
            lostApproval,
            foundApproval
        );

        if (claim.status !== "Returned") {
            if (
                currentUser.uid === claim.lostOwnerUid &&
                !claim.lostOwnerApproved
            ) {
                const button = document.createElement("button");

                button.textContent =
                    "Confirm I Received the Item";

                button.addEventListener("click", function () {
                    approveClaim(claimId);
                });

                card.appendChild(button);
            }

            if (
                currentUser.uid === claim.foundOwnerUid &&
                !claim.foundOwnerApproved
            ) {
                const button = document.createElement("button");

                button.textContent =
                    "Confirm I Handed Over the Item";

                button.addEventListener("click", function () {
                    approveClaim(claimId);
                });

                card.appendChild(button);
            }

        } else {
            const completed = document.createElement("p");

            completed.textContent =
                "Both students approved. Item returned!";

            card.appendChild(completed);
        }

        claimContainer.appendChild(card);
    });
}

// ======================================
// PRIVATE CHAT
// ======================================

// Display conversations
function renderChatList() {
    if (!chatList || !currentUser) return;

    chatList.innerHTML = "";

    const claims = Object.entries(allClaims);

    if (claims.length === 0) {
        const empty = document.createElement("p");

        empty.textContent =
            "Your conversations will appear here after a claim request is sent.";

        chatList.appendChild(empty);
        return;
    }

    claims.sort(function (a, b) {
        const timeA = a[1].createdAt?.seconds || 0;
        const timeB = b[1].createdAt?.seconds || 0;

        return timeB - timeA;
    });

    claims.forEach(function ([claimId, claim]) {
        const conversation =
            document.createElement("button");

        conversation.type = "button";
        conversation.className = "chat-conversation";

        const role =
            currentUser.uid === claim.lostOwnerUid
                ? "the finder"
                : "the lost item owner";

        conversation.textContent =
            "Conversation with " +
            role +
            " — " +
            claim.status;

        conversation.addEventListener("click", function () {
            openChat(claimId, claim);
        });

        chatList.appendChild(conversation);
    });
}

// Open a conversation
function openChat(claimId, claim) {
    if (!currentUser || !chatWindow || !chatMessages) {
        return;
    }

    if (
        currentUser.uid !== claim.lostOwnerUid &&
        currentUser.uid !== claim.foundOwnerUid
    ) {
        alert(
            "You are not allowed to open this conversation."
        );
        return;
    }

    currentChatId = claimId;
    chatWindow.hidden = false;

    if (chatHeader) {
        chatHeader.textContent =
            currentUser.uid === claim.lostOwnerUid
                ? "Chat with the finder"
                : "Chat with the lost item owner";
    }

    chatMessages.innerHTML =
        "<p>Loading messages...</p>";

    updateChatStatus(claim);

    if (stopMessagesListener) {
        stopMessagesListener();
        stopMessagesListener = null;
    }

    stopMessagesListener = db.collection("claims")
        .doc(claimId)
        .collection("messages")
        .orderBy("createdAt", "asc")
        .onSnapshot(function (snapshot) {
            chatMessages.innerHTML = "";

            if (snapshot.empty) {
                chatMessages.innerHTML =
                    "<p>No messages yet. Start the conversation!</p>";
                return;
            }

            snapshot.forEach(function (doc) {
                const message = doc.data();

                const messageBox =
                    document.createElement("div");

                messageBox.className =
                    "chat-message " +
                    (
                        message.senderUid === currentUser.uid
                            ? "my-message"
                            : "other-message"
                    );

                const messageText =
                    document.createElement("p");

                messageText.textContent = message.text;

                const timeText =
                    document.createElement("small");

                if (message.createdAt?.toDate) {
                    timeText.textContent =
                        message.createdAt.toDate()
                            .toLocaleString();
                } else {
                    timeText.textContent = "Sending...";
                }

                messageBox.append(messageText, timeText);
                chatMessages.appendChild(messageBox);
            });

            chatMessages.scrollTop =
                chatMessages.scrollHeight;

        }, function (error) {
            console.error("Chat loading error:", error);

            chatMessages.textContent =
                "Could not load messages: " + error.message;
        });
}

// Enable or disable chat
function updateChatStatus(claim) {
    if (!chatForm || !chatInput) return;

    const returned =
        claim.status === "Returned";

    chatInput.disabled = returned;

    const button = chatForm.querySelector(
        "button[type='submit']"
    );

    if (button) {
        button.disabled = returned;

        button.textContent =
            returned ? "Chat Closed" : "Send";
    }

    chatInput.placeholder = returned
        ? "This item has been returned. Chat is closed."
        : "Type your message...";
}

// Send a message
if (chatForm) {
    chatForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!currentUser || !currentChatId) {
            alert("Please select a conversation first.");
            return;
        }

        const text = chatInput.value.trim();

        if (!text) return;

        const claim = allClaims[currentChatId];

        if (!claim || claim.status !== "Pending") {
            alert("This conversation is closed.");

            if (claim) updateChatStatus(claim);

            return;
        }

        if (
            currentUser.uid !== claim.lostOwnerUid &&
            currentUser.uid !== claim.foundOwnerUid
        ) {
            alert(
                "You cannot send messages in this conversation."
            );
            return;
        }

        const button = chatForm.querySelector(
            "button[type='submit']"
        );

        try {
            if (button) button.disabled = true;

            await db.collection("claims")
                .doc(currentChatId)
                .collection("messages")
                .add({
                    senderUid: currentUser.uid,
                    text: text,
                    createdAt:
                        firebase.firestore.FieldValue.serverTimestamp()
                });

            chatInput.value = "";

        } catch (error) {
            console.error("Message sending error:", error);

            alert(
                "Could not send message: " + error.message
            );

        } finally {
            if (button && claim.status === "Pending") {
                button.disabled = false;
            }
        }
    });
}

// ======================================
// NOTIFICATION: NEW CHAT MESSAGES
// ======================================

// Listen for new messages in each claim
function startNotificationMessageListener(claimId) {
    if (notificationMessageListeners[claimId]) {
        return;
    }

    let firstSnapshot = true;

    const stopListener = db.collection("claims")
        .doc(claimId)
        .collection("messages")
        .orderBy("createdAt", "asc")
        .onSnapshot(function (snapshot) {

            // Do not notify about old messages
            // when the listener first starts
            if (firstSnapshot) {
                firstSnapshot = false;
                return;
            }

            snapshot.docChanges().forEach(function (change) {
                if (change.type !== "added") return;

                const message = change.doc.data();

                // Do not notify the sender about their own message
                if (message.senderUid === currentUser.uid) {
                    return;
                }

                const preview =
                    String(message.text || "").slice(0, 100);

                addNotification(
                    "message-" + claimId + "-" + change.doc.id,
                    "New Chat Message",
                    preview,
                    "chat",
                    claimId,
                    message.createdAt
                );
            });

        }, function (error) {
            console.error(
                "Notification message listener error:",
                error
            );
        });

    notificationMessageListeners[claimId] = stopListener;
}

// ======================================
// NOTIFICATION: CLAIM EVENTS
// ======================================

function processClaimNotifications(claimId, claim) {
    if (!currentUser) return;

    const previous = previousClaimStates[claimId];

    // First time this claim is loaded on this device
    if (!previous) {

        // Notify the Finder about a pending new claim
        if (
            currentUser.uid === claim.foundOwnerUid &&
            claim.status === "Pending"
        ) {
            addNotification(
                "claim-request-" + claimId,
                "New Claim Request",
                "A student has sent a claim request for your Found item.",
                "claim",
                claimId,
                claim.createdAt
            );
        }

        // Show an approval notification if the other
        // student had already approved while this user was away
        if (
            claim.lostOwnerApproved &&
            currentUser.uid === claim.foundOwnerUid
        ) {
            addNotification(
                "claim-approval-" + claimId + "-lost",
                "Claim Approved",
                "The Lost item owner has confirmed receiving the item.",
                "claim",
                claimId,
                claim.createdAt
            );
        }

        if (
            claim.foundOwnerApproved &&
            currentUser.uid === claim.lostOwnerUid
        ) {
            addNotification(
                "claim-approval-" + claimId + "-found",
                "Claim Approved",
                "The Finder has confirmed handing over the item.",
                "claim",
                claimId,
                claim.createdAt
            );
        }

        if (claim.status === "Returned") {
            addNotification(
                "claim-returned-" + claimId,
                "Item Returned",
                "Both students confirmed. The item has been marked as returned.",
                "claim",
                claimId,
                claim.createdAt
            );
        }

        previousClaimStates[claimId] = {
            lostOwnerApproved: claim.lostOwnerApproved,
            foundOwnerApproved: claim.foundOwnerApproved,
            status: claim.status
        };

        return;
    }

    // Lost owner approved
    if (
        !previous.lostOwnerApproved &&
        claim.lostOwnerApproved &&
        currentUser.uid === claim.foundOwnerUid
    ) {
        addNotification(
            "claim-approval-" + claimId + "-lost",
            "Claim Approved",
            "The Lost item owner has confirmed receiving the item.",
            "claim",
            claimId
        );
    }

    // Finder approved
    if (
        !previous.foundOwnerApproved &&
        claim.foundOwnerApproved &&
        currentUser.uid === claim.lostOwnerUid
    ) {
        addNotification(
            "claim-approval-" + claimId + "-found",
            "Claim Approved",
            "The Finder has confirmed handing over the item.",
            "claim",
            claimId
        );
    }

    // Both students confirmed the return
    if (
        previous.status !== "Returned" &&
        claim.status === "Returned"
    ) {
        addNotification(
            "claim-returned-" + claimId,
            "Item Returned",
            "Both students confirmed. The item has been marked as returned.",
            "claim",
            claimId
        );
    }

    previousClaimStates[claimId] = {
        lostOwnerApproved: claim.lostOwnerApproved,
        foundOwnerApproved: claim.foundOwnerApproved,
        status: claim.status
    };
}

// ======================================
// LISTEN FOR CLAIM REQUESTS
// ======================================

let stopLostClaims = null;
let stopFoundClaims = null;

function listenToClaims(user) {
    if (stopLostClaims) stopLostClaims();
    if (stopFoundClaims) stopFoundClaims();

    Object.values(notificationMessageListeners).forEach(
        function (stopListener) {
            stopListener();
        }
    );

    notificationMessageListeners = {};
    previousClaimStates = {};
    allClaims = {};

    // Claims where current user is Lost owner
    stopLostClaims = db.collection("claims")
        .where("lostOwnerUid", "==", user.uid)
        .onSnapshot(function (snapshot) {

            snapshot.forEach(function (doc) {
                const claim = doc.data();

                allClaims[doc.id] = claim;

                processClaimNotifications(doc.id, claim);

                startNotificationMessageListener(doc.id);

                if (claim.status === "Returned") {
                    hideReturnedReports(doc.id, claim);
                }
            });

            renderClaimRequests();
            renderChatList();
            findMatches();

            if (
                currentChatId &&
                allClaims[currentChatId]
            ) {
                updateChatStatus(allClaims[currentChatId]);
            }

        }, function (error) {
            console.error(
                "Lost claim listener error:",
                error
            );
        });

    // Claims where current user is Found owner
    stopFoundClaims = db.collection("claims")
        .where("foundOwnerUid", "==", user.uid)
        .onSnapshot(function (snapshot) {

            snapshot.forEach(function (doc) {
                const claim = doc.data();

                allClaims[doc.id] = claim;

                processClaimNotifications(doc.id, claim);

                startNotificationMessageListener(doc.id);

                if (claim.status === "Returned") {
                    hideReturnedReports(doc.id, claim);
                }
            });

            renderClaimRequests();
            renderChatList();
            findMatches();

            if (
                currentChatId &&
                allClaims[currentChatId]
            ) {
                updateChatStatus(allClaims[currentChatId]);
            }

        }, function (error) {
            console.error(
                "Found claim listener error:",
                error
            );
        });
}

// ======================================
// FIND POSSIBLE MATCHES
// ======================================

function findMatches() {
    if (!matchContainer) return;

    matchContainer.innerHTML = "";

    const heading = document.createElement("h2");
    heading.textContent = "Possible Matches";

    matchContainer.appendChild(heading);

    const activeReports = allReports.filter(
        report => report.returned !== true
    );

    const lostReports = activeReports.filter(
        report => report.status === "Lost"
    );

    const foundReports = activeReports.filter(
        report => report.status === "Found"
    );

    const matches = [];

    lostReports.forEach(function (lost) {
        foundReports.forEach(function (found) {

            if (lost.ownerUid === found.ownerUid) {
                return;
            }

            const result = calculateMatch(lost, found);

            if (!result) return;

            const claimId = lost.id + "_" + found.id;

            const existingClaim = allClaims[claimId];

            if (existingClaim?.status === "Returned") {
                return;
            }

            matches.push({
                lost: lost,
                found: found,
                result: result,
                newest: Math.max(
                    lost.createdAt?.seconds || 0,
                    found.createdAt?.seconds || 0
                )
            });
        });
    });

    matches.sort(function (a, b) {
        return b.newest - a.newest;
    });

    if (matches.length === 0) {
        const message = document.createElement("p");

        message.textContent =
            "No possible matches found yet.";

        matchContainer.appendChild(message);
        return;
    }

    matches.forEach(function (match) {
        const card = document.createElement("div");
        card.className = "item-card";

        const heading = document.createElement("h3");

        heading.textContent =
            "Possible Match: " +
            match.lost.itemName +
            " / " +
            match.found.itemName;

        const nameScore = document.createElement("p");

        nameScore.textContent =
            "Name Similarity: " +
            match.result.name +
            "%";

        const overallScore = document.createElement("p");

        overallScore.textContent =
            "Overall Match: " +
            match.result.total +
            "%";

        const lostLocation = document.createElement("p");

        lostLocation.textContent =
            "Lost Location: " +
            match.lost.location;

        const foundLocation = document.createElement("p");

        foundLocation.textContent =
            "Found Location: " +
            match.found.location;

        const lostDescription = document.createElement("p");

        lostDescription.textContent =
            "Lost Description: " +
            match.lost.description;

        const foundDescription = document.createElement("p");

        foundDescription.textContent =
            "Found Description: " +
            match.found.description;

        card.append(
            heading,
            nameScore,
            overallScore,
            lostLocation,
            foundLocation,
            lostDescription,
            foundDescription
        );

        if (
            currentUser &&
            match.lost.ownerUid === currentUser.uid
        ) {
            const button = document.createElement("button");

            button.textContent = "Send Claim Request";

            button.addEventListener("click", function () {
                createClaimRequest(
                    match.lost,
                    match.found
                );
            });

            card.appendChild(button);

        } else if (
            currentUser &&
            match.found.ownerUid === currentUser.uid
        ) {
            const message = document.createElement("p");

            message.textContent =
                "Waiting for the Lost item owner to send a claim request.";

            card.appendChild(message);
        }

        matchContainer.appendChild(card);
    });
}

// ======================================
// LISTEN FOR REPORTS
// ======================================

let stopReports = null;

function listenToReports() {
    if (stopReports) stopReports();

    if (itemContainer) {
        itemContainer.innerHTML =
            "<p>Loading items...</p>";
    }

    stopReports = db.collection("reports")
        .orderBy("createdAt", "desc")
        .onSnapshot(function (snapshot) {

            allReports = [];

            snapshot.forEach(function (doc) {
                allReports.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            renderReports();
            findMatches();

        }, function (error) {
            console.error(
                "Firestore reports loading error:",
                error
            );

            if (itemContainer) {
                itemContainer.innerHTML =
                    "<p>Could not load items: " +
                    error.message +
                    "</p>";
            }
        });
}

// ======================================
// SEARCH AND FILTERS
// ======================================

if (searchInput) {
    searchInput.addEventListener(
        "input",
        renderReports
    );
}

if (categoryFilter) {
    categoryFilter.addEventListener(
        "change",
        renderReports
    );
}

if (statusFilter) {
    statusFilter.addEventListener(
        "change",
        renderReports
    );
}

// ======================================
// FIREBASE AUTHENTICATION
// ======================================

auth.onAuthStateChanged(function (user) {

    if (user) {
        currentUser = user;

        console.log(
            "FindIt connected. User:",
            user.uid
        );

        // Load this student's saved notifications
        loadNotifications();

        // Listen for reports and claims
        listenToReports();
        listenToClaims(user);

    } else {
        currentUser = null;

        auth.signInAnonymously().catch(function (error) {
            console.error(
                "Anonymous login error:",
                error
            );

            if (itemContainer) {
                itemContainer.innerHTML =
                    "<p>Login failed: " +
                    error.message +
                    "</p>";
            }
        });
    }
});
