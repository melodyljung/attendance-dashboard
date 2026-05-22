<script>
    import { db, auth, googleProvider } from "../../firebase.js";
    import {
        onAuthStateChanged,
        signInWithPopup,
        signOut,
    } from "firebase/auth";
    import {
        collection,
        query,
        where,
        orderBy,
        onSnapshot,
        getDocs,
        deleteDoc,
        doc,
        getDoc,
        setDoc,
    } from "firebase/firestore";
    import { onDestroy } from "svelte";

    const availableClasses = [
        "All",
        "EK1A",
        "EK1B",
        "EK1C",
        "EK2A",
        "EK2B",
        "EK2C",
        "EK3A",
        "EK3B",
        "EK3C",
        "NA1A",
        "NA1B",
        "NA1C",
        "NA2A",
        "NA2B",
        "NA2C",
        "NA3A",
        "NA3B",
        "NA3C",
        "SA1",
        "SA2",
        "SA3",
    ];

    const dashboardState = $state({
        // Authentication & Authorization States
        /** @type {import('firebase/auth').User | null} */
        currentUser: null,
        isCheckingAuth: true,
        isAuthorized: false,

        // Existing logs states
        selectedClass: "All",
        selectedDate: new Intl.DateTimeFormat("sv-SE").format(new Date()),
        /** @type {any[]} */
        attendanceRecords: [],

        // Fields for creating a lecture session
        /** @type {any[]} */
        totalLecturesList: [],
        newLectureTopic: "",
        generatedQrUrl: "",
        generatedLectureId: "",

        // Fields for adding a new teacher
        newTeacherEmail: "",
        whitelistFeedback: "",
    });

    const localDateString = new Intl.DateTimeFormat("sv-SE").format(new Date());

    /** @type {(() => void) | null} */
    let unsubscribe = null;

    // Monitor authentication status
    onAuthStateChanged(auth, async (user) => {
        dashboardState.currentUser = user;

        if (user && user.email) {
            dashboardState.isCheckingAuth = true;

            try {
                const teacherDocRef = doc(db, "allowed_teachers", user.email);
                const teacherDocSnap = await getDoc(teacherDocRef);

                if (teacherDocSnap.exists()) {
                    dashboardState.isAuthorized = true;
                    if (typeof startAttendanceListener === "function") {
                        startAttendanceListener(
                            dashboardState.selectedClass,
                            dashboardState.selectedDate,
                        ); // Start the listener immediately after confirming authorization
                    }
                    if (typeof startLecturesListener === "function") {
                        startLecturesListener(); // Start the lectures listener as well
                    }
                } else {
                    dashboardState.isAuthorized = false;
                }
            } catch (error) {
                console.error("Authorization error:", error);
                dashboardState.isAuthorized = false;
            }

            dashboardState.isCheckingAuth = false;
        } else {
            dashboardState.isAuthorized = false;
            if (unsubscribe) unsubscribe(); // Clean up any active listeners if the user logs out
            dashboardState.isCheckingAuth = false;
        }
    });

    // Listener for lectures (to populate the "Active & Past Sessions" list)
    function startLecturesListener() {
        const lecturesRef = collection(db, "lectures");
        const q = query(lecturesRef, orderBy("createdAt", "desc"));
        return onSnapshot(q, (snapshot) => {
            /** @type {any[]} */
            let tempLectures = [];
            snapshot.forEach((doc) => {
                tempLectures.push({
                    ...doc.data(),
                    id: doc.id,
                    createdAt: doc.data().createdAt,
                });
            });
            dashboardState.totalLecturesList = tempLectures;
        });
    }

    // Listener for attendance records based on selected class and date filters
    /** * @param {string} className
     * @param {string} dateString
     */
    function startAttendanceListener(className, dateString) {
        // Clean up any old active connection first
        if (unsubscribe) unsubscribe();

        const attendanceRef = collection(db, "attendance");
        let q;

        if (className === "All") {
            q = query(attendanceRef, where("dateString", "==", dateString));
        } else {
            q = query(
                attendanceRef,
                where("class", "==", className),
                where("dateString", "==", dateString),
            );
        }

        // Listen for live updates
        unsubscribe = onSnapshot(q, (snapshot) => {
            /** @type {any[]} */
            let tempRecords = [];
            snapshot.forEach((doc) => {
                tempRecords.push({ id: doc.id, ...doc.data() });
            });
            tempRecords.sort((a, b) => b.timestamp - a.timestamp);
            dashboardState.attendanceRecords = tempRecords;
        });
    }

    // $effect runs automatically when the page loads, and re-runs whenever variables inside it (like selectedClass or selectedDate) are modified.
    $effect(() => {
        if (
            dashboardState.currentUser &&
            dashboardState.isAuthorized &&
            !dashboardState.isCheckingAuth
        ) {
            startAttendanceListener(
                dashboardState.selectedClass,
                dashboardState.selectedDate,
            );
            startLecturesListener();
        }
    });

    // Function to create a new lecture session, which generates a unique ID, saves it to Firestore, and creates a QR code link for students to check in with.
    async function createLecture() {
        if (!dashboardState.newLectureTopic.trim()) {
            alert("Please type a lecture topic first!");
            return;
        }

        // Generate a unique 7-character alphanumeric ID for the lecture session (for easy retrieval and human readability
        const chars =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        const uniqueId = Array(7)
            .fill(0)
            .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
            .join("");

        try {
            // 1. Save the new lecture session to the 'lectures' collection
            const docRef = doc(db, "lectures", uniqueId); // Use the generated unique ID as the document ID for easy retrieval
            await setDoc(docRef, {
                topic: dashboardState.newLectureTopic,
                createdAt: new Date().toLocaleString("sv-SE"),
                dateString: localDateString,
            });

            // 2. Build the exact web link the student's phone needs to visit to check in for this lecture session using the unique ID
            const studentTargetUrl = `attendance-dashboard-melody-ljung-s-projects.vercel.app/attend/${docRef.id}`;

            // 3. Generate a QR code image link using the public charts API
            dashboardState.generatedQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(studentTargetUrl)}`;
            dashboardState.generatedLectureId = docRef.id;

            alert(
                `Lecture "${dashboardState.newLectureTopic}" created successfully!`,
            );
        } catch (error) {
            console.error("Error creating lecture:", error);
        }
    }

    // Function to delete a lecture session from Firestore. Note: This does not delete attendance records, just the lecture session itself. If the deleted lecture is currently active on display, it also clears the display.
    /** @param {string} id */
    async function deleteLecture(id) {
        const confirmation = confirm(
            "Are you sure you want to delete this lecture session? (Note: This won't delete student attendance history logs, just the lecture session itself.)",
        );
        if (!confirmation) return;

        try {
            await deleteDoc(doc(db, "lectures", id));

            // If the teacher deletes the currently active QR code on display, hide the display card
            if (dashboardState.generatedLectureId === id) {
                dashboardState.generatedQrUrl = "";
                dashboardState.generatedLectureId = "";
                dashboardState.newLectureTopic = "";
            }
            alert("Lecture session deleted successfully!");
        } catch (error) {
            console.error("Error deleting lecture:", error);
        }
    }

    // Function to clear attendance history logs for a specific class and date. This permanently deletes the records from Firestore, so it asks for confirmation first. It also requires the teacher to select a specific class (not "All") to prevent accidental mass deletions.
    async function clearHistory() {
        if (dashboardState.selectedClass === "All") {
            alert("Please select a specific class before clearing data.");
            return;
        }

        const confirmation = confirm(
            `Are you sure you want to permanently delete all attendance records for ${dashboardState.selectedClass} on ${dashboardState.selectedDate}?`,
        );

        if (confirmation) {
            const attendanceRef = collection(db, "attendance");
            const q = query(
                attendanceRef,
                where("class", "==", dashboardState.selectedClass),
                where("dateString", "==", dashboardState.selectedDate),
            );
            const querySnapshot = await getDocs(q);

            querySnapshot.forEach(async (documentSnapshot) => {
                await deleteDoc(doc(db, "attendance", documentSnapshot.id));
            });

            alert(`Data cleared for ${dashboardState.selectedClass}!`);
        }
    }

    // Function to add a new teacher's email to the "allowed_teachers" collection in Firestore, which grants them access to the dashboard.
    async function addTeacher() {
        if (!dashboardState.currentUser || !dashboardState.currentUser.email)
            return;
        if (!dashboardState.newTeacherEmail.trim()) {
            alert("Please enter an email address first!");
            return;
        }

        const confirmation = confirm(
            `Are you sure you want to add ${dashboardState.newTeacherEmail} as an authorized teacher? This will grant them access to the admin dashboard.`,
        );
        if (!confirmation) {
            dashboardState.newTeacherEmail = "";
            return;
        }

        const cleanEmail = dashboardState.newTeacherEmail.trim();

        try {
            const teacherDocRef = doc(db, "allowed_teachers", cleanEmail);

            if ((await getDoc(teacherDocRef)).exists()) {
                dashboardState.whitelistFeedback = `${cleanEmail} is already on the allowed teachers list.`;
                dashboardState.newTeacherEmail = "";
                return;
            }

            await setDoc(teacherDocRef, {
                email: cleanEmail,
                dateAdded: new Date().toLocaleString("sv-SE"),
                addedBy: dashboardState.currentUser.email,
            });

            dashboardState.whitelistFeedback = `Successfully added ${cleanEmail} to allowed teachers list!`;
            dashboardState.newTeacherEmail = "";
        } catch (error) {
            console.error("Error adding teacher:", error);
            dashboardState.whitelistFeedback = `Error adding ${cleanEmail}. Please try again.`;
        }
    }

    async function login() {
        await signInWithPopup(auth, googleProvider);
    }
    async function logout() {
        await signOut(auth);
    }

    // Always clean up database connections if the teacher leaves this page
    onDestroy(() => {
        if (unsubscribe) unsubscribe();
    });
</script>

<main>
    {#if dashboardState.isCheckingAuth}
        <div class="auth-gate-card">
            <p>Verifying admin credentials...</p>
        </div>
    {:else if !dashboardState.currentUser}
        <div class="auth-gate-card">
            <h2>Teacher Admin Portal</h2>
            <p>
                Please log in with your staff Google credentials to access the
                admin dashboard.
            </p>
            <button class="google-blue-btn" onclick={login}>
                <div class="icon-wrapper">
                    <span class="google-letter">G</span>
                </div>
                <span class="btn-text-blue">Sign in with Google</span>
            </button>
        </div>
    {:else if dashboardState.currentUser && !dashboardState.isAuthorized && !dashboardState.isCheckingAuth}
        <div class="auth-gate-card error-gate">
            <h2>Access Denied</h2>
            <p>
                The account <strong>{dashboardState.currentUser.email}</strong> is
                not authorized to view this console.
            </p>
            <button class="red-btn" onclick={logout}>Log Out</button>
        </div>
    {:else}
        <header>
            <h1 class="panel-title">Teacher Admin Panel</h1>
            <div class="header-buttons">
                <button
                    class="red-btn"
                    onclick={() => (window.location.href = "/")}
                >
                    Return to Home
                </button>
                <button class="red-btn" onclick={logout}>Log Out</button>
            </div>
        </header>

        <p>
            Logged in as <strong
                >{dashboardState.currentUser.displayName}</strong
            >
        </p>

        <section class="lecture-creator">
            <h2>Create Active Lecture Session</h2>
            <div class="input-row">
                <input
                    type="text"
                    placeholder="Type lecture topic..."
                    bind:value={dashboardState.newLectureTopic}
                />
                <button class="create-btn" onclick={createLecture}
                    >Generate QR Link</button
                >
            </div>

            {#if dashboardState.generatedQrUrl}
                <div class="qr-display-card">
                    <h3>Session Active: {dashboardState.newLectureTopic}</h3>
                    <p class="id-sub">
                        Lecture ID: <code
                            >{dashboardState.generatedLectureId}</code
                        >
                    </p>

                    <div class="qr-frame">
                        <img
                            src={dashboardState.generatedQrUrl}
                            alt="Scan to attend lecture"
                        />
                    </div>

                    <p class="instruction">
                        Project this QR code onto the classroom screen for
                        students to scan.
                    </p>
                    <a
                        href="/attend/{dashboardState.generatedLectureId}"
                        target="_blank"
                        class="test-link"
                    >
                        Open Student View Link ↗
                    </a>
                </div>
            {/if}

            <div class="lecture-history-section">
                <h3>Active & Past Sessions</h3>
                {#if dashboardState.totalLecturesList.length === 0}
                    <p class="no-lectures-msg">
                        No active lecture sessions created yet.
                    </p>
                {:else}
                    <ul class="lecture-management-list">
                        {#each dashboardState.totalLecturesList as lecture}
                            <li>
                                <div class="lecture-info">
                                    <span class="lecture-id-badge"
                                        >{lecture.id}</span
                                    >
                                    <span class="lecture-date-badge"
                                        >{lecture.dateString || "No Date"}</span
                                    >
                                    <strong>{lecture.topic}</strong>
                                </div>
                                <button
                                    class="delete-icon-btn"
                                    onclick={() => deleteLecture(lecture.id)}
                                    title="Delete Session"
                                >
                                    Delete
                                </button>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>
        </section>

        <section class="log-container">
            <h2>Live Attendance Logs</h2>

            <section class="filters">
                <div class="filter-group">
                    <label for="classFilter">Class:</label>
                    <select
                        id="classFilter"
                        bind:value={dashboardState.selectedClass}
                    >
                        {#each availableClasses as className}
                            <option value={className}>{className}</option>
                        {/each}
                    </select>
                </div>
                <div class="filter-group">
                    <label for="dateFilter">Date:</label>
                    <input
                        type="date"
                        id="dateFilter"
                        bind:value={dashboardState.selectedDate}
                    />
                </div>
                <button class="red-btn clear-btn" onclick={clearHistory}
                    >Clear Selected History</button
                >
            </section>

            {#if dashboardState.attendanceRecords.length === 0}
                <p class="empty-msg">
                    No check-ins found for this class and date.
                </p>
            {:else}
                <ul class="log-list">
                    {#each dashboardState.attendanceRecords as record}
                        <li>
                            <div class="log-left">
                                <span class="time">[{record.time}]</span>
                                <span class="badge">{record.class}</span>
                                <strong>{record.student}</strong>
                            </div>
                            <div class="log-right">
                                <span class="lecture-tag"
                                    >{record.lectureTopic ||
                                        "General Check-in"}</span
                                >
                            </div>
                        </li>
                    {/each}
                </ul>
            {/if}
        </section>

        <section class="add-teacher-section">
            <h2>Add Authorized Teacher</h2>
            <div class="input-row">
                <input
                    type="email"
                    placeholder="Enter teacher's email..."
                    bind:value={dashboardState.newTeacherEmail}
                />
                <button class="create-btn" onclick={addTeacher}
                    >Add Teacher</button
                >
            </div>
            {#if dashboardState.whitelistFeedback}
                <p class="whitelist-feedback">
                    {dashboardState.whitelistFeedback}
                </p>
            {/if}
        </section>
    {/if}
</main>

<style>
    @import "./dashboard.css";
</style>
