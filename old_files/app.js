// UNUSED: these are old files from the original project, kept here for reference but not used in the final implementation.

// Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, where, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBIFPg8JocImYtoRe-84a-nrbUaaKiQNcM",
    authDomain: "student-attendance-170806.firebaseapp.com",
    projectId: "student-attendance-170806",
    storageBucket: "student-attendance-170806.firebasestorage.app",
    messagingSenderId: "867670859335",
    appId: "1:867670859335:web:793fd7fcf88ef82d2a5b62"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Date Input
const dateInput = document.getElementById('filterDate');

// Get today's date formatted as YYYY-MM-DD
const today = new Date().toISOString().split('T')[0];
dateInput.value = today;

// Listener
// 1. Grab the new filter element
const classDropdown = document.getElementById('filterClass');
let unsubscribe; // We'll use this to "stop" the old listener before starting a new one

// 2. Create the function that starts the listener
function startAttendanceListener(className, selectedDate) {
    // If a listener is already running, kill it! (Prevents memory leaks)
    if (unsubscribe) unsubscribe();

    let q;
    const attendanceRef = collection(db, "attendance");

    // Logic: If 'All', get everything. Otherwise, use 'where' to filter.
    if (className === "all") {
        q = query(attendanceRef,
            where("dateString", "==", selectedDate),
            orderBy("timestamp", "desc")
        );
    } else {
        // This is like: SELECT * FROM attendance WHERE class == className
        q = query(attendanceRef, 
            where("class", "==", className), 
            where("dateString", "==", selectedDate),
            orderBy("timestamp", "desc")
        );
    }

    // Start the live listener
    unsubscribe = onSnapshot(q, (snapshot) => {
        const listElement = document.getElementById('historyList');
        listElement.innerHTML = "";
        
        snapshot.forEach((doc) => {
            const record = doc.data();
            const li = document.createElement('li');
            li.innerText = `${record.time} - ${record.student} (${record.class})`;
            listElement.appendChild(li);
        });
    });
}


// 3. Listen for the dropdown changing
classDropdown.addEventListener('change', () => {
    startAttendanceListener(classDropdown.value, dateInput.value);
});
dateInput.addEventListener('change', () => {
    startAttendanceListener(classDropdown.value, dateInput.value);
});


document.addEventListener('DOMContentLoaded', () => {
    // This ensures the listener starts with the correct date filter on page load
    startAttendanceListener(classDropdown.value, dateInput.value);
});



// Button

const submitBtn = document.getElementById('submitBtn');
const messageText = document.getElementById('message');

submitBtn.addEventListener('click', async () => {
    // Grabbing the values using .value
    const name = document.getElementById('studentName').value;
    const studentClass = document.getElementById('classSelect').value;

    // Basic Validation (Check if fields are empty)
    if (name === "" || studentClass === "") {
        messageText.innerText = "Please fill in all fields!";
        messageText.style.color = "red";
        return; // Stop the function here
    }

    try {
        // This is the 'INSERT' command for Firestore
        const docRef = await addDoc(collection(db, "attendance"), {
            student: name,
            class: studentClass,
            time: new Date().toLocaleTimeString(), 
            dateString: new Date().toISOString().split('T')[0], // Saves exactly "2026-05-19"
            timestamp: Date.now() // This is the actual timestamp for sorting and querying
        });

        console.log("Document written with ID: ", docRef.id);
        alert("Check-in saved to the Cloud! ☁️");
    } catch (e) {
        console.error("Error adding document: ", e);
    }

    messageText.innerText = `Success! ${name} is checked in for ${studentClass}.`;
    messageText.style.color = "green";
});


// Delete Button Logic
const clearBtn = document.getElementById('clearBtn');

clearBtn.addEventListener('click', async () => {
    const currentClass = classDropdown.value;
    const currentDate = dateInput.value;

    if (currentClass === "all") {
        alert("Please select a specific class before clearing data.");
        return;
    }

    const confirmation = confirm(`Are you sure you want to delete all attendance records for ${currentClass} on ${currentDate}? This cannot be undone.`);
    
    if (confirmation) {
        const attendanceRef = collection(db, "attendance");
        // Find the exact matches
        const q = query(attendanceRef, where("class", "==", currentClass), where("dateString", "==", currentDate));
        
        // Fetch them once
        const querySnapshot = await getDocs(q);
        
        // Loop through matches and delete them one by one
        querySnapshot.forEach(async (documentSnapshot) => {
            await deleteDoc(doc(db, "attendance", documentSnapshot.id));
        });

        alert(`Data cleared for ${currentClass}!`);
    }
});