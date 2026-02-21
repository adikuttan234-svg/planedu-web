const loggedInFaculty = sessionStorage.getItem("loggedInFaculty");

if (!loggedInFaculty) {
  window.location.href = "login.html";
}

const adminTimetables = JSON.parse(localStorage.getItem("adminTimetables")) || [];

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const totalPeriods = 8;

function generateFacultyTimetable() {
  const table = document.createElement("table");

  const headerRow = document.createElement("tr");
  headerRow.innerHTML = "<th>Day</th>";
  for (let p = 1; p <= totalPeriods; p++) {
    headerRow.innerHTML += "<th>P" + p + "</th>";
  }
  table.appendChild(headerRow);

  days.forEach(day => {
    const row = document.createElement("tr");
    row.innerHTML = "<td>" + day + "</td>";

    for (let p = 1; p <= totalPeriods; p++) {
      const cell = document.createElement("td");
      cell.textContent = "";

      adminTimetables.forEach(sem => {
        const dayData = sem.timetable[day];
        if (!dayData) return;

        dayData.forEach(entry => {
          if (
            entry.period === p &&
            entry.faculty === loggedInFaculty
          ) {
            cell.textContent = entry.subject + " (" + sem.semester + ")";
          }
        });
      });

      row.appendChild(cell);
    }

    table.appendChild(row);
  });

  document.getElementById("timetable").appendChild(table);
}

function generateWorkload() {
  let count = 0;

  adminTimetables.forEach(sem => {
    days.forEach(day => {
      const dayData = sem.timetable[day];
      if (!dayData) return;

      dayData.forEach(entry => {
        if (entry.faculty === loggedInFaculty) {
          count++;
        }
      });
    });
  });

  document.getElementById("workload").innerText =
    "Total Periods Per Week: " + count;
}

document.getElementById("prefForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const pref = {
    faculty: loggedInFaculty,
    day: document.getElementById("day").value,
    period: document.getElementById("period").value,
    score: document.getElementById("score").value
  };

  const prefs = JSON.parse(localStorage.getItem("facultyPreferences")) || [];
  prefs.push(pref);
  localStorage.setItem("facultyPreferences", JSON.stringify(prefs));

  this.reset();
});

generateFacultyTimetable();
generateWorkload();
