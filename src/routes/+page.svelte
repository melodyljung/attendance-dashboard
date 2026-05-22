<script>
    import { goto } from "$app/navigation";

    let inputLectureId = $state("");

    function handleStudentJoin() {
        if (!inputLectureId.trim()) return;

        const cleanId = inputLectureId.trim().split("/").pop();
        goto(`/attend/${cleanId}`);
    }
</script>

<main class="landing-container">
    <header class="hero">
        <h1>Student Attendance</h1>
        <p>Attendance management for students and teachers</p>
    </header>

    <div class="portal-grid">
        <section class="portal-card teacher-card">
            <h2>Teachers & Staff</h2>
            <p>
                Access your admin console, manage allowed emails, generate
                secure session QR codes, and view attendance logs.
            </p>
            <a href="/dashboard" class="action-btn teacher-btn"
                >Go to Admin Dashboard →</a
            >
        </section>

        <section class="portal-card student-card">
            <h2>Students</h2>
            <p>
                Enter the unique 7-character lecture code provided by your
                teacher to register for the lecture.
            </p>

            <form
                onsubmit={(e) => {
                    e.preventDefault();
                    handleStudentJoin();
                }}
                class="join-form"
            >
                <input
                    type="text"
                    placeholder="Example: ABC1234"
                    bind:value={inputLectureId}
                    maxlength="50"
                />
                <button
                    type="submit"
                    class="action-btn student-btn"
                    disabled={!inputLectureId}
                >
                    Join Lecture
                </button>
            </form>
        </section>
    </div>
</main>

<style>
    .landing-container {
        max-width: 1000px;
        margin: 0 auto;
        padding: 40px 20px;
        font-family:
            system-ui,
            -apple-system,
            sans-serif;
        color: #1e293b;
    }
    .hero {
        text-align: center;
        margin-bottom: 50px;
        flex-direction: column;
        display: flex;
        align-items: center;
    }
    .hero h1 {
        font-size: 2.8rem;
        color: #0f172a;
        margin-bottom: 10px;
        font-weight: 800;
    }
    .hero p {
        font-size: 1.2rem;
        color: #64748b;
    }
    .portal-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
        gap: 30px;
        margin-top: 20px;
    }
    .portal-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 40px;
        box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.05),
            0 2px 4px -1px rgba(0, 0, 0, 0.03);
        display: flex;
        flex-direction: column;
        align-items: stretch;
    }
    .portal-card h2 {
        font-size: 1.5rem;
        margin-bottom: 12px;
        color: #0f172a;
    }
    .portal-card p {
        color: #64748b;
        line-height: 1.6;
        margin-bottom: 30px;
        flex-grow: 1;
    }
    .action-btn {
        display: inline-block;
        /* width: 100%; */
        text-align: center;
        padding: 14px 20px;
        border-radius: 8px;
        font-weight: 600;
        text-decoration: none;
        transition: all 0.2s ease;
        border: none;
        cursor: pointer;
        font-size: 1rem;
    }
    .teacher-btn {
        background: #fe9fe1;
        color: white;
    }
    .teacher-btn:hover {
        background: rgb(233, 101, 194);
    }
    .join-form {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .join-form input {
        padding: 12px 16px;
        border: 2px solid #cbd5e1;
        border-radius: 8px;
        font-size: 1rem;
        outline: none;
        transition: border-color 0.2s;
    }
    .join-form input:focus {
        border-color: #fe9fe1;
    }
    .student-btn {
        background: #fe9fe1;
        color: white;
    }
    .student-btn:hover:not(:disabled) {
        background: rgb(233, 101, 194);
    }
    .student-btn:disabled {
        background: #cbd5e1;
        color: #94a3b8;
        cursor: not-allowed;
    }
</style>
