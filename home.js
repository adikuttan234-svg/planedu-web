if (sessionStorage.getItem("role") !== "faculty") {
  window.location.href = "login.html";
}

function logout() {
  sessionStorage.clear();
  window.location.href = "login.html";
}

function showSection(id) {
  document.querySelectorAll("section").forEach(s => s.style.display = "none");
  document.getElementById(id).style.display = "block";
}

loadProfile();
loadTimetable();
loadWorkload();
loadGraph();
showSection("profile");

function loadProfile() {
  const p = JSON.parse(sessionStorage.getItem("facultyProfile"));
  document.getElementById("profile").innerHTML =
    "<h3>Profile</h3>" +
    "<p>Name: " + p.name + "</p>" +
    "<p>Email: " + p.email + "</p>" +
    "<p>Department: " + p.department + "</p>" +
    "<p>Designation: " + p.designation + "</p>";
}

function loadTimetable() {
  const name = sessionStorage.getItem("loggedInFaculty");
  const data = JSON.parse(localStorage.getItem("adminTimetables")) || [];

  const days = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
  const periods = 8;

  let html = "<h3>My Timetable</h3><table><tr><th>Day</th>";
  for (let i = 1; i <= periods; i++) html += "<th>P" + i + "</th>";
  html += "</tr>";

  days.forEach(day => {
    html += "<tr><td>" + day + "</td>";
    for (let p = 1; p <= periods; p++) {
      let cell = "";
      data.forEach(sem => {
        (sem.timetable[day] || []).forEach(e => {
          if (e.faculty === name && e.period === p) {
            cell = e.subject + " (" + sem.semester + ")";
          }
        });
      });
      html += "<td>" + cell + "</td>";
    }
    html += "</tr>";
  });

  html += "</table>";
  document.getElementById("timetable").innerHTML = html;
}

function loadWorkload() {
  const name = sessionStorage.getItem("loggedInFaculty");
  const data = JSON.parse(localStorage.getItem("adminTimetables")) || [];
  let count = 0;

  data.forEach(sem => {
    Object.values(sem.timetable).forEach(day =>
      day.forEach(e => {
        if (e.faculty === name) count++;
      })
    );
  });

  document.getElementById("workload").innerHTML =
    "<h3>Workload</h3><p>Total periods per week: " + count + "</p>";
}

function loadGraph() {
  const name = sessionStorage.getItem("loggedInFaculty");
  const data = JSON.parse(localStorage.getItem("adminTimetables")) || [];
  const days = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
  const result = { Monday:0, Tuesday:0, Wednesday:0, Thursday:0, Friday:0 };

  data.forEach(sem => {
    days.forEach(d => {
      (sem.timetable[d] || []).forEach(e => {
        if (e.faculty === name) result[d]++;
      });
    });
  });

  let html = "<h3>Work Graph</h3>";
  days.forEach(d => {
    html += "<p>" + d + ": " + result[d] + " periods</p>";
  });

  document.getElementById("graph").innerHTML = html;
}
