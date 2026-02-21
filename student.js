const API = "http://localhost:3000/api";

async function loadTimetable() {
  const res = await fetch(
    API + "/student/timetable?dept=" + dept.value + "&sem=" + sem.value
  );
  const data = await res.json();
  document.getElementById("timetable").innerText =
    JSON.stringify(data, null, 2);
}

function downloadPDF() {
  window.open(
    API + "/student/timetable/pdf?dept=" + dept.value + "&sem=" + sem.value
  );
}
