const message = "Hello from JavaScript!";
console.log(message);

// A simple function (similar to 'def' in Python)
function greet(name) {
    return `Welcome, ${name}!`;
}

function updateClock() {
    // // 1. Get the current date/time object (Like datetime.now() in Python)
    // const now = new Date();

    // // 2. Extract hours, minutes, and seconds
    // // We use .padStart(2, '0') so "5" seconds looks like "05"
    // const hours = String(now.getHours()).padStart(2, '0');
    // const minutes = String(now.getMinutes()).padStart(2, '0');
    // const seconds = String(now.getSeconds()).padStart(2, '0');

    // // 3. Format the string (Backticks are like f-strings in Python!)
    // const timeString = `${hours}:${minutes}:${seconds}`;

    // // 4. Send it to the HTML
    // document.getElementById('clock').innerText = timeString;

    // if (seconds < 30) {
    //     clockElement.style.color = "pink";
    // } else {
    //     clockElement.style.color = "lightblue";
    // }

    const now = new Date();
    const seconds = now.getSeconds();
    const clockElement = document.getElementById('clock');

    // Display the time
    clockElement.innerText = now.toLocaleTimeString();

    // Change color every 30 seconds
    if (seconds < 30) {
        clockElement.style.color = "pink";
    } else {
        clockElement.style.color = "lightblue";
    }
}

// Call the function immediately to set the clock on page load
updateClock();

// Call the function every second to update the clock
setInterval(updateClock, 1000);

console.log(greet("Developer"));