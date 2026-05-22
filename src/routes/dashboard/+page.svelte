<script>
    import { db, auth, googleProvider } from "../../firebase.js"; // Notice the double '../../' to jump out two folders!
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
        addDoc,
        getDoc,
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
            if (unsubscribe) unsubscribe();
            dashboardState.isCheckingAuth = false;
        }
    });

    // Initial Listener for Today's Lectures (to populate the "Active & Past Sessions" list)
    function startLecturesListener() {
        const lecturesRef = collection(db, "lectures");
        const q = query(lecturesRef);
        return onSnapshot(q, (snapshot) => {
            /** @type {any[]} */
            let tempLectures = [];
            snapshot.forEach((doc) => {
                tempLectures.push({ id: doc.id, ...doc.data() });
            });
            dashboardState.totalLecturesList = tempLectures;
        });
    }

    // The Active Listener Function
    // This runs whenever selectedClass or selectedDate changes
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
            dashboardState.attendanceRecords = tempRecords; // Updating this array repaints the HTML!
        });
    }

    // Svelte 5 Effect Runner
    // $effect runs automatically when the page loads, and re-runs whenever
    // variables inside it (like selectedClass or selectedDate) are modified.
    $effect(() => {
        if (dashboardState.currentUser && dashboardState.isAuthorized &&!dashboardState.isCheckingAuth) {
            startAttendanceListener(
                dashboardState.selectedClass,
                dashboardState.selectedDate,
            );
             startLecturesListener();
        }
    });

    // Create a dynamic lecture session
    async function createLecture() {
        if (!dashboardState.newLectureTopic.trim()) {
            alert("Please type a lecture topic first!");
            return;
        }

        try {
            // 1. Save the new lecture session to the 'lectures' collection
            const docRef = await addDoc(collection(db, "lectures"), {
                topic: dashboardState.newLectureTopic,
                createdAt: new Date().toLocaleString("sv-SE"), // Store a human-readable date string for easier querying and display
                dateString: localDateString,
            });

            // 2. Build the exact web link the student's phone needs to visit
            // Note: When you launch online, replace 'localhost:5173' with your actual domain!
            const studentTargetUrl = `attendance-dashboard-lhls9yahd-melody-ljung-s-projects.vercel.app/attend/${docRef.id}`;

            // 3. Generate a QR code image link using the public charts API
            dashboardState.generatedQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(studentTargetUrl)}`;
            dashboardState.generatedLectureId = docRef.id;

            // alert(`Lecture "${dashboardState.newLectureTopic}" created successfully!`);
        } catch (error) {
            console.error("Error creating lecture:", error);
        }
    }

    // Delete a lecture document by its unique ID
    /** @param {string} id */
    async function deleteLecture(id) {
        const confirmation = confirm(
            "Are you sure you want to delete this lecture session? (Note: This won't delete student attendance history logs, just the QR session code itself.)",
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

    // Clear History Button (GDPR compliant manual deletion)
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
            <button class="clear-btn" onclick={logout}>Log Out</button>
        </div>
    {:else}
        <header>
            <h1>Teacher Admin Panel</h1>
            <button class="clear-btn" onclick={logout}>Log Out</button>
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
                                    <a
                                        href="/attend/{lecture.id}"
                                        target="_blank"
                                        class="test-link"
                                    >
                                        Open Student View Link ↗
                                    </a>
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
            <button class="clear-btn" onclick={clearHistory}
                >Clear Selected History</button
            >
        </section>

        <section class="log-container">
            <h2>Live Attendance Logs</h2>

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
                                <strong>{record.student}</strong>
                                <span class="badge">{record.class}</span>
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
    {/if}
</main>

<style>
    @import "./dashboard.css";
</style>
