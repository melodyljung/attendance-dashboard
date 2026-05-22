<script>
    import { auth, googleProvider, db } from '../../../firebase.js';
    import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
    import { collection, addDoc, doc, getDoc, setDoc, where, getDocs, query } from 'firebase/firestore';
    import { page } from '$app/state'; 

    // Available classes array for first-time profile setups
    const availableClasses = [
        "EK1A", "EK1B", "EK1C", "EK2A", "EK2B", "EK2C", "EK3A", "EK3B", "EK3C",
        "NA1A", "NA1B", "NA1C", "NA2A", "NA2B", "NA2C", "NA3A", "NA3B", "NA3C",
        "SA1", "SA2", "SA3"
    ];

    /** @type {import('firebase/auth').User | null} */ // Type annotation for better clarity on the user state
    let user = $state(null);
    let selectedClass = $state('EK1A'); // Used for the first-time picker dropdown
    let checkedIn = $state(false);
    let hasProfile = $state(false);
    let loggedTime = $state('');

    // Lecture-specific states
    let lectureTopic = $state('Loading lecture details...');
    let lectureIsValid = $state(false);

    const currentLectureId = page.params.lectureId;

    onAuthStateChanged(auth, async (currentUser) => {
        user = currentUser;
        if (currentUser) {
            await checkUserProfile(currentUser);
        } else {
            checkedIn = false;
            hasProfile = false;
        }
    });

    // Runs once on page load to verify the lecture session and pre-check their attendance status if they're already logged in
    $effect(() => {
        verifyLectureSession();
        
        // If they are already logged in when opening the page, check if they already checked in for this lecture to skip straight to the final screen state
        if (user && user.email && currentLectureId) {
            checkIfAlreadyCheckedIn();
        }
    });

    // Function to verify the lecture without forcing a class lock
    async function verifyLectureSession() {
        // Guard clause: If the lecture ID from the URL is missing, stop immediately and show an error message
        if (!currentLectureId) {
            lectureTopic = "No lecture ID provided. Please scan a valid QR code.";
            lectureIsValid = false;
            return;
        }

        const lectureDocRef = doc(db, "lectures", currentLectureId);
        const lectureSnap = await getDoc(lectureDocRef);

        if (lectureSnap.exists()) {
            const lectureData = lectureSnap.data();
            lectureTopic = lectureData.topic; // Only pull the name of the lesson for display
            lectureIsValid = true;
        } else {
            lectureTopic = "Invalid or expired lecture link. Please ask your teacher for a new QR code.";
            lectureIsValid = false;
        }
    }

    /** @param {import('firebase/auth').User} currentUser */
    async function checkUserProfile(currentUser) {
        if (!currentUser.email) return;
        const userDocRef = doc(db, "users", currentUser.email);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            selectedClass = userData.class; // Pre-fills the dropdown with their saved class for a more personalized experience
            hasProfile = true; 
        } else {
            hasProfile = false;
        }
    }

    async function saveProfile() {
        if (!user || !user.email) return;
        await setDoc(doc(db, "users", user.email), {
            name: user.displayName,
            email: user.email,
            class: selectedClass // Saves the choice they picked from the dropdown
        });
        hasProfile = true;
    }

    async function checkIn() {
        if (!user || !lectureIsValid) return;

        try {
            const localDateString = new Intl.DateTimeFormat('sv-SE').format(new Date());
            const exactTime = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            // Look for an existing receipt for this email + lecture combination
            const attendanceRef = collection(db, "attendance");
            const duplicateQuery = query(
                attendanceRef,
                where("email", "==", user.email),
                where("lectureId", "==", currentLectureId)
            );
            
            const querySnapshot = await getDocs(duplicateQuery);

            // If the snapshot isn't empty, they've already checked in for this lecture
            if (!querySnapshot.empty) {
                checkedIn = true; // Flips the screen UI to the success/done state safely
                alert("You have already checked into this lecture session!");
                return; // Exits the function to prevent adding a duplicate attendance record
            }

            // Log uses the student's personal class + the shared lecture topic
            await addDoc(collection(db, "attendance"), {
                student: user.displayName,
                email: user.email,
                class: selectedClass,
                lectureId: currentLectureId, 
                lectureTopic: lectureTopic,
                time: exactTime,
                dateString: localDateString,
                timestamp: Date.now()
            });

            loggedTime = exactTime; // Store the exact time they checked in for display on the final screen
            checkedIn = true;
            alert(`Successfully checked into ${lectureTopic}!`);
        } catch (error) {
            console.error(error);
        }
    }

    // Function to pre-check their status
    async function checkIfAlreadyCheckedIn() {
        if (!user || !user.email) return;
        
        const q = query(
            collection(db, "attendance"),
            where("email", "==", user.email),
            where("lectureId", "==", currentLectureId)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            loggedTime = snapshot.docs[0].data().time || ''; // Grabs the time they originally checked in for display
            checkedIn = true; // Skip straight to the "✓ Attendance Logged" screen state
        }
    }

    // Lets students jump back to the onboarding state to edit their profile
    function enableProfileEditing() {
        hasProfile = false;
    }

    async function login() { await signInWithPopup(auth, googleProvider); }
    async function logout() { await signOut(auth); }
</script>

<main>
    <header>
        <h1>Lecture Gate Checkout</h1>
        {#if user}
            <button class="logout-btn" onclick={logout}>Log Out</button>
        {/if}
    </header>

    <section class="card">
        {#if !lectureIsValid}
            <p class="error-msg">{lectureTopic}</p>
            <a href="/" class="leave-btn">Return to Home</a>

        {:else if !user}
            <h2>Class Registration</h2>
            <p>Scanning for: <strong>{lectureTopic}</strong></p>
            <p>Please log in with your Google account to confirm identity.</p>
            <button class="google-blue-btn" onclick={login}>
                <div class="icon-wrapper">
                    <span class="google-letter">G</span>
                </div>
                <span class="btn-text-blue">Sign in with Google</span>
            </button>

        {:else if user && !hasProfile}
            <h2>One-Time Profile Setup</h2>
            <p>Welcome <strong>{user.displayName}</strong>! Please select your permanent home class below:</p>
            
            <div class="form-group">
                <label for="classSelect">Choose Class:</label>
                <select id="classSelect" bind:value={selectedClass}>
                    {#each availableClasses as className}
                        <option value={className}>{className}</option>
                    {/each}
                </select>
            </div>
            <button class="submit-btn" onclick={saveProfile}>Confirm Profile Setup</button>

        {:else if user && hasProfile && !checkedIn}
            <h2>Welcome, {user.displayName}!</h2>
            <p>Ready to log check-in for lecture: <strong>{lectureTopic}</strong>.</p>
            <p>Your registered home class is: <span class="badge">{selectedClass}</span></p>
            <button class="submit-btn" onclick={checkIn}>Check Into Lecture</button>
            <button class="edit-profile-btn" onclick={enableProfileEditing}>
                Wrong class? Edit profile
            </button>

        {:else}
            <div class="success-box">
                <h2>✓ Attendance Logged</h2>
                <p>Your attendance for <strong>{lectureTopic}</strong> has been secured.</p>
                <p class="timestamp">Time: {loggedTime}</p>
            </div>
        {/if}
    </section>
</main>

<style>
    main {
        font-family: "Lucida Sans", "Lucida Sans Regular", "Lucida Grande",
            "Lucida Sans Unicode", Geneva, Verdana, sans-serif;
        max-width: 500px;
        margin: 40px auto;
        padding: 20px;
    }
    header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
    }
    h1 {
        font-size: 1.5rem;
        margin: 0;
    }
    .card {
        background: #f9f9f9;
        border: 1px solid #ddd;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    }
    .form-group {
        margin: 20px 0;
    }
    select {
        width: 100%;
        padding: 10px;
        font-size: 1rem;
        border-radius: 4px;
    }
    button {
        width: 100%;
        padding: 12px;
        font-size: 1rem;
        font-weight: bold;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }
    .leave-btn {
        color: #e73c67;
        font-size: 0.85rem;
        text-decoration: none;
    }
    .leave-btn:hover {
        text-decoration: underline;
    }

    .google-blue-btn {
        display: flex;
        align-items: center;
        background-color: #4285f4; /* Official Google Blue */
        color: white;
        border: none;
        border-radius: 2px;
        padding: 1px;
        height: 40px;
        font-size: 14px;
        font-weight: 500;
        font-family: Roboto, sans-serif;
        cursor: pointer;
        width: 100%;
        box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.25);
        transition: filter 0.2s;
    }

    .google-blue-btn:hover {
        filter: brightness(1.05);
    }

    .icon-wrapper {
        background-color: #ffffff;
        border-radius: 1px;
        width: 38px;
        height: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .google-letter {
        color: #4285f4;
        font-size: 22px;
        font-weight: bold;
        font-family: "Product Sans", Arial, sans-serif;
    }

    .btn-text-blue {
        margin: 0 auto;
        padding-right: 38px; 
    }
    .submit-btn {
        background: #fe9fe1;
        color: white;
    }
    .logout-btn {
        width: auto;
        padding: 6px 12px;
        font-size: 0.8rem;
        background: #e73c67;
        color: white;
    }
    .edit-profile-btn {
        width: auto;
        padding: 6px 0px;
        font-size: 0.8rem;
        font-style: italic;
        background: #f9f9f9;
        color: #7f8c8d;
        margin-top: 10px;
    }
    .edit-profile-btn:hover {
        opacity: 1;
        color: #fe9fe1;
    }
    .success-box {
        text-align: center;
        color: #fe9fe1;
    }
    .timestamp {
        color: #666;
        font-size: 0.9rem;
    }
</style>
