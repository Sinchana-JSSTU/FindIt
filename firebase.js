
// FINDIT FIREBASE CONFIGURATION

const firebaseConfig = {
    apiKey: "AIzaSyAgm-RSbGfF0foNbGycHnua7Lp6oNxavZQ",
    authDomain: "findit-new-cb9fa.firebaseapp.com",
    projectId: "findit-new-cb9fa",
    messagingSenderId: "544163202777",
    appId: "1:544163202777:web:b6e43c22cc684509c220c8"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Start Anonymous Authentication
firebase.auth().signInAnonymously()
    .then(function () {
        console.log("FindIt Firebase connected successfully!");
    })
    .catch(function (error) {
        console.error("Firebase authentication error:", error);
    });




