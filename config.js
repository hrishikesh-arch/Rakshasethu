// ============================================================
// RakshaSetu — Configuration File
// Replace placeholder values with your actual API keys
// ============================================================

const CONFIG = {
    // Firebase Configuration
    // Get yours at: https://console.firebase.google.com
    firebase: {
        apiKey: "YOUR_FIREBASE_API_KEY",
        authDomain: "your-app.firebaseapp.com",
        databaseURL: "https://your-app-default-rtdb.firebaseio.com",
        projectId: "your-project-id",
        storageBucket: "your-app.appspot.com",
        messagingSenderId: "000000000000",
        appId: "your-app-id"
    },

    // EmailJS Configuration
    // Get yours at: https://www.emailjs.com
    emailjs: {
        publicKey: "YOUR_EMAILJS_PUBLIC_KEY",
        serviceId: "YOUR_EMAILJS_SERVICE_ID",
        templateId: "YOUR_EMAILJS_TEMPLATE_ID"
    },

    // Twilio Configuration for SMS Alerts
    // Get yours at: https://www.twilio.com
    twilio: {
        accountSid: "YOUR_TWILIO_ACCOUNT_SID",
        authToken: "YOUR_TWILIO_AUTH_TOKEN",
        phoneNumber: "YOUR_TWILIO_PHONE_NUMBER"
    },

    // OpenCage Geocoding Configuration
    // Get yours at: https://opencagedata.com/users/sign_up
    opencage: {
        apiKey: "YOUR_OPENCAGE_API_KEY"
    },

    // App Settings
    app: {
        name: "RakshaSetu",
        version: "1.0.0",
        sosCountdownSeconds: 3,
        locationUpdateInterval: 30000,  // 30 seconds
        maxContacts: 10,
        maxRecordings: 10,
        recordingChunkDuration: 30000,  // 30 seconds per chunk
        shakeThreshold: 30,
        checkInGracePeriod: 300000,     // 5 minutes
        checkInEscalation: 600000,      // 10 minutes
        stealthCode: "911",
        stealthUnlockCode: "1091",
        emergencyNumbers: {
            police: "100",
            emergency: "112",
            womenHelpline: "1091",
            childHelpline: "1098"
        }
    }
};
