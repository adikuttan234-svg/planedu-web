// Security Check
if (localStorage.getItem("isLoggedIn") !== "true") {
  window.location.href = "login.html";
}

function saveData() {
  const cells = document.querySelectorAll(".edit-cell");
  const schedule = Array.from(cells).map(td => td.innerText);
  localStorage.setItem("saved_schedule", JSON.stringify(schedule));
  alert("Timetable Saved to Cloud!");
}

// Load data on start
window.onload = () => {
  const saved = JSON.parse(localStorage.getItem("saved_schedule") || "[]");
  const cells = document.querySelectorAll(".edit-cell");
  cells.forEach((td, i) => {
    if (saved[i]) td.innerText = saved[i];
  });

  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
  }
};

function toggleDark() {
  document.body.classList.toggle("dark");
  const mode = document.body.classList.contains("dark") ? "dark" : "light";
  localStorage.setItem("theme", mode);
}

function logout() {
  localStorage.removeItem("isLoggedIn");
  window.location.href = "index.html";
}
