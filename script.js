
let reportType = "";
let allReports = [];
let allClaims = {};
let currentUser = null;

const auth = firebase.auth();
const db = firebase.firestore();

const CLOUDINARY_CLOUD_NAME = "vxcdf9jy";
const CLOUDINARY_UPLOAD_PRESET = "findit_upload";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
];

const PHOTO_MATCHER_WORKER_URL =
    "https://findit-photo-matcher.sinchanasd420.workers.dev";

const photoSimilarityCache = new Map();
const photoSimilarityRequests = new Map();

let matchRenderVersion = 0;

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
const itemPhoto = document.getElementById("itemPhoto");
const submitReport = document.getElementById("submitReport");

const itemContainer = document.getElementById("itemContainer");
const matchContainer = document.getElementById("matchContainer");

const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const statusFilter = document.getElementById("statusFilter");

// ======================================
// CLAIM SECTION
// ======================================

let claimContainer = document.getElementById("claimContainer");

if (!claimContainer && matchContainer?.parentNode) {
    claimContainer = document.createElement("div");
    claimContainer.id = "claimContainer";

    matchContainer.parentNode.insertBefore(
        claimContainer,
        matchContainer.nextSibling
    );
}

// ======================================
// PRIVATE CHAT
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
// NOTIFICATIONS
// ======================================

const notificationList =
    document.getElementById("notificationList");

const notificationBadge =
    document.getElementById("notificationBadge");

let allNotifications = [];
let notificationMessageListeners = {};
let previousClaimStates = {};
let notificationStorageKey = "";
let readNotificationIds = [];

// ======================================
// LOAD NOTIFICATIONS
// ======================================

async function loadNotifications() {
    if (!currentUser) return;

    const uid = currentUser.uid;

    notificationStorageKey = "findit_notifications_" + uid;

    try {
        const saved = JSON.parse(
            localStorage.getItem(notificationStorageKey) || "[]"
        );

        allNotifications = Array.isArray(saved) ? saved : [];

    } catch (error) {
        console.error("Notification loading error:", error);
        allNotifications = [];
    }

    try {
        const snapshot = await db
            .collection("notificationSettings")
            .doc(uid)
            .get();

        if (!currentUser || currentUser.uid !== uid) return;

        const settings = snapshot.exists ? snapshot.data() : {};

        const firestoreReadIds =
            Array.isArray(settings.readNotificationIds)
                ? settings.readNotificationIds
                : [];

        readNotificationIds = [
            ...new Set([
                ...readNotificationIds,
                ...firestoreReadIds
            ])
        ].slice(-500);

        allNotifications.forEach(function (notification) {
            notification.read =
                readNotificationIds.includes(notification.id);
        });

        saveNotifications();

    } catch (error) {
        console.error(
            "Firestore notification settings error:",
            error
        );
    }

    if (currentUser?.uid === uid) {
        renderNotifications();
    }
}

// ======================================
// SAVE NOTIFICATIONS
// ======================================

function saveNotifications() {
    if (!currentUser || !notificationStorageKey) return;

    if (
        notificationStorageKey !==
        "findit_notifications_" + currentUser.uid
    ) return;

    try {
        localStorage.setItem(
            notificationStorageKey,
            JSON.stringify(allNotifications)
        );
    } catch (error) {
        console.error("Notification saving error:", error);
    }
}

// ======================================
// SAVE READ STATUS
// ======================================

async function saveNotificationReadState() {
    if (!currentUser) return;

    const uid = currentUser.uid;

    try {
        readNotificationIds = [
            ...new Set(readNotificationIds)
        ].slice(-500);

        await db.collection("notificationSettings")
            .doc(uid)
            .set({
                readNotificationIds: readNotificationIds,
                updatedAt:
                    firebase.firestore.FieldValue.serverTimestamp()
            }, {
                merge: true
            });

    } catch (error) {
        console.error(
            "Could not save notification read status:",
            error
        );
    }
}

// ======================================
// ADD NOTIFICATION
// ======================================

function addNotification(
    id,
    title,
    message,
    type,
    claimId = "",
    time = null
) {
    if (!currentUser) return;

    if (
        allNotifications.some(
            notification => notification.id === id
        )
    ) return;

    allNotifications.push({
        id: id,
        title: title,
        message: message,
        type: type,
        claimId: claimId,
        timeMs: time?.toDate
            ? time.toDate().getTime()
            : Date.now(),
        read: readNotificationIds.includes(id)
    });

    saveNotifications();
    renderNotifications();
}

// ======================================
// DISPLAY NOTIFICATIONS
// ======================================

function renderNotifications() {
    if (!notificationList) return;

    allNotifications.sort((a, b) => b.timeMs - a.timeMs);
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

        card.addEventListener("click", async function () {
            if (!notification.read) {
                notification.read = true;

                if (!readNotificationIds.includes(notification.id)) {
                    readNotificationIds.push(notification.id);
                }

                saveNotifications();
                renderNotifications();
                await saveNotificationReadState();
            }

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
// CLOUDINARY IMAGE VALIDATION
// ======================================

function validatePhoto(file) {
    if (!file) return true;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        alert("Please select a JPG, PNG or WEBP image.");
        return false;
    }

    if (file.size > MAX_IMAGE_SIZE) {
        alert("Photo size must be 5 MB or less.");
        return false;
    }

    return true;
}

// ======================================
// UPLOAD PHOTO
// ======================================

async function uploadPhotoToCloudinary(file) {
    if (!file) return "";

    const formData = new FormData();

    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const uploadURL =
        "https://api.cloudinary.com/v1_1/" +
        CLOUDINARY_CLOUD_NAME +
        "/image/upload";

    const response = await fetch(uploadURL, {
        method: "POST",
        body: formData
    });

    const result = await response.json();

    if (!response.ok) {
        console.error("Cloudinary error:", result);

        throw new Error(
            result.error?.message || "Photo upload failed."
        );
    }

    if (!result.secure_url) {
        throw new Error("Cloudinary did not return a photo URL.");
    }

    return result.secure_url;
}

// ======================================
// DISPLAY PHOTO
// ======================================

function createPhotoElement(photoURL) {
    if (!photoURL) return null;

    const image = document.createElement("img");

    image.src = photoURL;
    image.alt = "Uploaded item photo";
    image.loading = "lazy";

    image.style.width = "100%";
    image.style.maxWidth = "300px";
    image.style.maxHeight = "220px";
    image.style.objectFit = "contain";
    image.style.borderRadius = "10px";
    image.style.marginBottom = "12px";

    image.onerror = function () {
        image.alt = "Photo could not be loaded";
        image.style.display = "none";
    };

    return image;
}

// ======================================
// REPORT FORM BUTTONS
// ======================================

if (lostBtn) {
    lostBtn.addEventListener("click", function () {
        reportType = "Lost";

        if (formTitle) {
            formTitle.textContent = "Report Lost Item";
        }

        reportPanel?.classList.add("active");
    });
}

if (foundBtn) {
    foundBtn.addEventListener("click", function () {
        reportType = "Found";

        if (formTitle) {
            formTitle.textContent = "Report Found Item";
        }

        reportPanel?.classList.add("active");
    });
}

if (closePanel) {
    closePanel.addEventListener("click", function () {
        reportPanel?.classList.remove("active");
    });
}

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

        const selectedFile = itemPhoto?.files?.[0] || null;

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

        if (!validatePhoto(selectedFile)) return;

        try {
            if (submitReport) {
                submitReport.disabled = true;
                submitReport.textContent = selectedFile
                    ? "Uploading Photo..."
                    : "Submitting...";
            }

            let photoURL = "";

            if (selectedFile) {
                photoURL =
                    await uploadPhotoToCloudinary(selectedFile);
            }

            if (submitReport) {
                submitReport.textContent = "Saving Report...";
            }

            await db.collection("reports").add({
                itemName: itemName,
                category: category,
                location: location,
                itemDate: itemDate,
                description: description,
                status: reportType,
                ownerUid: currentUser.uid,
                photoURL: photoURL,
                createdAt:
                    firebase.firestore.FieldValue.serverTimestamp()
            });

            alert(reportType + " item reported successfully!");

            reportForm.reset();
            reportPanel?.classList.remove("active");
            reportType = "";

        } catch (error) {
            console.error("Report submission error:", error);

            alert(
                "Could not submit report: " + error.message
            );

        } finally {
            if (submitReport) {
                submitReport.disabled = false;
                submitReport.textContent = "Submit Report";
            }
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

    return 1 -
        matrix[a.length][b.length] /
        Math.max(a.length, b.length);
}

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

    phonetic /= Math.max(
        firstWords.length,
        secondWords.length
    );

    return Math.max(spelling, phonetic * 0.85);
}

function textSimilarity(first, second) {
    const a = normalizeText(first);
    const b = normalizeText(second);

    if (!a || !b) return 0;
    if (a === b) return 1;

    return editSimilarity(a, b);
}

// ======================================
// GEMINI PHOTO SIMILARITY
// ======================================

async function getPhotoSimilarity(lostPhotoURL, foundPhotoURL) {
    if (!lostPhotoURL || !foundPhotoURL) {
        return {
            score: 0,
            reason: "One or both photos are missing.",
            confidence: "low",
            available: false
        };
    }

    const cacheKey = [
        lostPhotoURL,
        foundPhotoURL
    ].sort().join("|");

    if (photoSimilarityCache.has(cacheKey)) {
        return photoSimilarityCache.get(cacheKey);
    }

    if (photoSimilarityRequests.has(cacheKey)) {
        return photoSimilarityRequests.get(cacheKey);
    }

    const request = (async function () {
        try {
            const response = await fetch(
                PHOTO_MATCHER_WORKER_URL,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        lostPhotoURL: lostPhotoURL,
                        foundPhotoURL: foundPhotoURL
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Photo comparison failed."
                );
            }

            const score = Number(data.photoScore);

            if (!Number.isFinite(score)) {
                throw new Error("Invalid photo score.");
            }

            const result = {
                score: Math.max(0, Math.min(100, score)),
                reason: data.reason || "",
                confidence: data.confidence || "low",
                available: true
            };

            photoSimilarityCache.set(cacheKey, result);

            return result;

        } catch (error) {
            console.error("Gemini photo matching error:", error);

            return {
                score: 0,
                reason: error.message,
                confidence: "low",
                available: false
            };

        } finally {
            photoSimilarityRequests.delete(cacheKey);
        }
    })();

    photoSimilarityRequests.set(cacheKey, request);

    return request;
}

// ======================================
// CALCULATE MATCH SCORE
// ======================================

function calculateMatch(lost, found, photoScore = 0) {
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

    const namePoints = nameScore * 50;
    const photoPoints = (photoScore / 100) * 20;
    const categoryPoints = categoryScore * 10;
    const locationPoints = locationScore * 10;
    const descriptionPoints = descriptionScore * 10;

    const total =
        namePoints +
        photoPoints +
        categoryPoints +
        locationPoints +
        descriptionPoints;

    if (total < 20) return null;

    return {
        name: Math.round(nameScore * 100),
        photo: Math.round(photoScore),
        namePoints: Number(namePoints.toFixed(1)),
        photoPoints: Number(photoPoints.toFixed(1)),
        categoryPoints: Number(categoryPoints.toFixed(1)),
        locationPoints: Number(locationPoints.toFixed(1)),
        descriptionPoints: Number(descriptionPoints.toFixed(1)),
        total: Math.round(total)
    };
}

// ======================================
// DISPLAY RECENT REPORTS
// ======================================

function renderReports() {
    if (!itemContainer) return;

    const search = normalizeText(searchInput?.value || "");
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

        const photo = createPhotoElement(report.photoURL);

        const statusText = document.createElement("p");
        statusText.textContent = "Status: " + report.status;

        const categoryText = document.createElement("p");
        categoryText.textContent = "Category: " + report.category;

        const locationText = document.createElement("p");
        locationText.textContent = "Location: " + report.location;

        const dateText = document.createElement("p");
        dateText.textContent = "Date: " + report.itemDate;

        const descriptionText = document.createElement("p");
        descriptionText.textContent =
            "Description: " + report.description;

        card.appendChild(heading);

        if (photo) card.appendChild(photo);

        card.append(
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

    if (lost.returned || found.returned) {
        alert("This item has already been returned.");
        return;
    }

    const claimId = lost.id + "_" + found.id;
    const claimRef = db.collection("claims").doc(claimId);

    // Check the claims already loaded by the claim listeners.
    if (allClaims[claimId]) {
        alert("A claim request already exists for this match.");
        return;
    }

    try {
        // Do not call claimRef.get() here.
        // A read of a claim that does not exist can be denied
        // by rules that only allow claim participants to read it.

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

        alert("Claim request sent successfully!");

    } catch (error) {
        console.error("Claim request error:", error);

        alert(
            "Could not send claim request: " + error.message
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
    ) return;

    if (
        currentUser.uid !== claim.lostOwnerUid &&
        currentUser.uid !== claim.foundOwnerUid
    ) return;

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
        console.error("Could not hide returned reports:", error);
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

            await hideReturnedReports(claimId, updatedClaim);

            alert(
                "Both students confirmed! The item is marked as returned."
            );

        } else {
            alert(
                "Your confirmation has been recorded. Waiting for the other student."
            );
        }

    } catch (error) {
        console.error("Claim approval error:", error);
        alert("Could not update claim: " + error.message);
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
            (claim.lostOwnerApproved ? "Approved" : "Waiting");

        const foundApproval = document.createElement("p");
        foundApproval.textContent =
            "Found item owner: " +
            (claim.foundOwnerApproved ? "Approved" : "Waiting");

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
// PRIVATE CHAT LIST
// ======================================

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
        const conversation = document.createElement("button");

        conversation.type = "button";
        conversation.className = "chat-conversation";

        const role =
            currentUser.uid === claim.lostOwnerUid
                ? "the finder"
                : "the lost item owner";

        conversation.textContent =
            "Conversation with " + role + " — " + claim.status;

        conversation.addEventListener("click", function () {
            openChat(claimId, claim);
        });

        chatList.appendChild(conversation);
    });
}

// ======================================
// OPEN CHAT
// ======================================

function openChat(claimId, claim) {
    if (!currentUser || !chatWindow || !chatMessages) return;

    if (
        currentUser.uid !== claim.lostOwnerUid &&
        currentUser.uid !== claim.foundOwnerUid
    ) {
        alert("You are not allowed to open this conversation.");
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

    chatMessages.innerHTML = "<p>Loading messages...</p>";

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

                const messageBox = document.createElement("div");

                messageBox.className =
                    "chat-message " +
                    (
                        message.senderUid === currentUser.uid
                            ? "my-message"
                            : "other-message"
                    );

                const messageText = document.createElement("p");
                messageText.textContent = message.text;

                const timeText = document.createElement("small");

                timeText.textContent = message.createdAt?.toDate
                    ? message.createdAt.toDate().toLocaleString()
                    : "Sending...";

                messageBox.append(messageText, timeText);
                chatMessages.appendChild(messageBox);
            });

            chatMessages.scrollTop = chatMessages.scrollHeight;

        }, function (error) {
            console.error("Chat loading error:", error);

            chatMessages.textContent =
                "Could not load messages: " + error.message;
        });
}

// ======================================
// CHAT STATUS
// ======================================

function updateChatStatus(claim) {
    if (!chatForm || !chatInput) return;

    const returned = claim.status === "Returned";

    chatInput.disabled = returned;

    const button = chatForm.querySelector(
        "button[type='submit']"
    );

    if (button) {
        button.disabled = returned;
        button.textContent = returned ? "Chat Closed" : "Send";
    }

    chatInput.placeholder = returned
        ? "This item has been returned. Chat is closed."
        : "Type your message...";
}

// ======================================
// SEND MESSAGE
// ======================================

if (chatForm) {
    chatForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!currentUser || !currentChatId) {
            alert("Please select a conversation first.");
            return;
        }

        const messageText = chatInput.value.trim();

        if (!messageText) return;

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
            alert("You cannot send messages in this conversation.");
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
                    text: messageText,
                    createdAt:
                        firebase.firestore.FieldValue.serverTimestamp()
                });

            chatInput.value = "";

        } catch (error) {
            console.error("Message sending error:", error);
            alert("Could not send message: " + error.message);

        } finally {
            if (
                button &&
                allClaims[currentChatId]?.status === "Pending"
            ) {
                button.disabled = false;
            }
        }
    });
}

// ======================================
// NOTIFICATION: CHAT MESSAGES
// ======================================

function startNotificationMessageListener(claimId) {
    if (notificationMessageListeners[claimId]) return;

    let firstSnapshot = true;

    const stopListener = db.collection("claims")
        .doc(claimId)
        .collection("messages")
        .orderBy("createdAt", "asc")
        .onSnapshot(function (snapshot) {
            if (firstSnapshot) {
                firstSnapshot = false;
                return;
            }

            snapshot.docChanges().forEach(function (change) {
                if (change.type !== "added") return;

                const message = change.doc.data();

                if (message.senderUid === currentUser?.uid) {
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

    if (!previous) {
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

            if (currentChatId && allClaims[currentChatId]) {
                updateChatStatus(allClaims[currentChatId]);
            }

        }, function (error) {
            console.error("Lost claim listener error:", error);
        });

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

            if (currentChatId && allClaims[currentChatId]) {
                updateChatStatus(allClaims[currentChatId]);
            }

        }, function (error) {
            console.error("Found claim listener error:", error);
        });
}

// ======================================
// FIND POSSIBLE MATCHES
// ======================================

async function findMatches() {
    if (!matchContainer) return;

    const renderVersion = ++matchRenderVersion;

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

    const possiblePairs = [];

    lostReports.forEach(function (lost) {
        foundReports.forEach(function (found) {
            if (lost.ownerUid === found.ownerUid) return;

            const nameScore = nameSimilarity(
                lost.itemName,
                found.itemName
            );

            if (nameScore < 0.30) return;

            const claimId = lost.id + "_" + found.id;
            const existingClaim = allClaims[claimId];

            if (existingClaim?.status === "Returned") return;

            possiblePairs.push({
                lost: lost,
                found: found,
                claimId: claimId
            });
        });
    });

    if (possiblePairs.length === 0) {
        const message = document.createElement("p");
        message.textContent = "No possible matches found yet.";

        matchContainer.appendChild(message);
        return;
    }

    const loading = document.createElement("p");
    loading.textContent = "Comparing item photos with AI...";

    matchContainer.appendChild(loading);

    // Compare all possible pairs.
    const results = await Promise.all(
        possiblePairs.map(async function (pair) {
            const photoResult = await getPhotoSimilarity(
                pair.lost.photoURL,
                pair.found.photoURL
            );

            const result = calculateMatch(
                pair.lost,
                pair.found,
                photoResult.score
            );

            if (!result) return null;

            return {
                lost: pair.lost,
                found: pair.found,
                claimId: pair.claimId,
                result: result,
                photoResult: photoResult,
                newest: Math.max(
                    pair.lost.createdAt?.seconds || 0,
                    pair.found.createdAt?.seconds || 0
                )
            };
        })
    );

    // Ignore an old matching operation if a newer one started.
    if (renderVersion !== matchRenderVersion) return;

    matchContainer.innerHTML = "";
    matchContainer.appendChild(heading);

    const matches = results.filter(Boolean);

    matches.sort(function (a, b) {
        return b.result.total - a.result.total;
    });

    if (matches.length === 0) {
        const message = document.createElement("p");
        message.textContent = "No possible matches found yet.";

        matchContainer.appendChild(message);
        return;
    }

    matches.forEach(function (match) {
        const card = document.createElement("div");
        card.className = "item-card";

        const title = document.createElement("h3");

        title.textContent =
            "Possible Match: " +
            match.lost.itemName +
            " / " +
            match.found.itemName;

        const nameScore = document.createElement("p");

        nameScore.textContent =
            "Name Similarity: " +
            match.result.name +
            "% (" +
            match.result.namePoints +
            "/50 points)";

        const photoScore = document.createElement("p");

        photoScore.textContent =
            "Photo Similarity: " +
            match.result.photo +
            "% (" +
            match.result.photoPoints +
            "/20 points)";

        const categoryScore = document.createElement("p");

        categoryScore.textContent =
            "Category: " +
            match.result.categoryPoints +
            "/10 points";

        const locationScore = document.createElement("p");

        locationScore.textContent =
            "Location: " +
            match.result.locationPoints +
            "/10 points";

        const descriptionScore = document.createElement("p");

        descriptionScore.textContent =
            "Description: " +
            match.result.descriptionPoints +
            "/10 points";

        const overallScore = document.createElement("h3");

        overallScore.textContent =
            "Overall Match: " +
            match.result.total +
            "%";

        const photoStatus = document.createElement("p");

        if (match.photoResult.available) {
            photoStatus.textContent =
                "AI Photo Analysis: " +
                match.photoResult.reason;
        } else {
            photoStatus.textContent =
                "AI Photo Analysis unavailable: " +
                match.photoResult.reason;
        }

        const lostLocation = document.createElement("p");

        lostLocation.textContent =
            "Lost Location: " + match.lost.location;

        const foundLocation = document.createElement("p");

        foundLocation.textContent =
            "Found Location: " + match.found.location;

        card.appendChild(title);

        const lostPhoto = createPhotoElement(
            match.lost.photoURL
        );

        if (lostPhoto) {
            const label = document.createElement("p");
            label.textContent = "Lost item photo:";

            card.append(label, lostPhoto);
        }

        const foundPhoto = createPhotoElement(
            match.found.photoURL
        );

        if (foundPhoto) {
            const label = document.createElement("p");
            label.textContent = "Found item photo:";

            card.append(label, foundPhoto);
        }

        card.append(
            nameScore,
            photoScore,
            categoryScore,
            locationScore,
            descriptionScore,
            overallScore,
            photoStatus,
            lostLocation,
            foundLocation
        );

        const lostDescription = document.createElement("p");

        lostDescription.textContent =
            "Lost Description: " + match.lost.description;

        const foundDescription = document.createElement("p");

        foundDescription.textContent =
            "Found Description: " + match.found.description;

        card.append(
            lostDescription,
            foundDescription
        );

        if (
            currentUser &&
            match.lost.ownerUid === currentUser.uid
        ) {
            const button = document.createElement("button");

            button.textContent = "Send Claim Request";

            const existingClaim =
                allClaims[match.claimId];

            if (existingClaim) {
                button.disabled = true;
                button.textContent =
                    "Claim Request Already Sent";
            }

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
        itemContainer.innerHTML = "<p>Loading items...</p>";
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
    searchInput.addEventListener("input", renderReports);
}

if (categoryFilter) {
    categoryFilter.addEventListener("change", renderReports);
}

if (statusFilter) {
    statusFilter.addEventListener("change", renderReports);
}

// ======================================
// FIREBASE AUTHENTICATION
// ======================================

auth.onAuthStateChanged(async function (user) {
    if (user) {
        if (currentUser?.uid !== user.uid) {
            currentUser = user;

            allNotifications = [];
            readNotificationIds = [];
            notificationStorageKey = "";
            previousClaimStates = {};
            allClaims = {};

            if (stopMessagesListener) {
                stopMessagesListener();
                stopMessagesListener = null;
            }

            currentChatId = null;

            if (stopLostClaims) stopLostClaims();
            if (stopFoundClaims) stopFoundClaims();
            if (stopReports) stopReports();

            await loadNotifications();

            if (currentUser?.uid !== user.uid) return;

            listenToReports();
            listenToClaims(user);
        }

        console.log(
            "FindIt connected. User:",
            user.uid
        );

    } else {
        currentUser = null;

        auth.signInAnonymously().catch(function (error) {
            console.error("Anonymous login error:", error);

            if (itemContainer) {
                itemContainer.innerHTML =
                    "<p>Login failed: " +
                    error.message +
                    "</p>";
            }
        });
    }
});
