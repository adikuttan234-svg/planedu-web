const API = "http://localhost:3000/api";

document.addEventListener("DOMContentLoaded", () => {
  const facultyForm = document.getElementById("facultyForm");
  const subjectForm = document.getElementById("subjectForm");

  if (facultyForm) {
    facultyForm.addEventListener("submit", saveFaculty);
  }

  if (subjectForm) {
    subjectForm.addEventListener("submit", saveSubject);
  }
});

async function saveFaculty(e) {
  e.preventDefault();

  const payload = {
    name: document.getElementById("facultyName").value.trim(),
    faculty_code: document.getElementById("facultyCode").value.trim(),
    department: document.getElementById("facultyDept").value.trim(),
    max_hours_per_week: Number(document.getElementById("facultyHours").value)
  };

  await fetch(API + "/admin/faculty", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  alert("Faculty saved");
  e.target.reset();
}

async function saveSubject(e) {
  e.preventDefault();

  const payload = {
    name: document.getElementById("subjectName").value.trim(),
    subject_code: document.getElementById("subjectCode").value.trim(),
    department: document.getElementById("subjectDept").value.trim(),
    semester: Number(document.getElementById("subjectSem").value),
    type: document.getElementById("subjectType").value,
    required_hours_per_week: Number(document.getElementById("subjectHours").value)
  };

  await fetch(API + "/admin/subject", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  alert("Subject saved");
  e.target.reset();
}

async function generateTimetable() {
  const res = await fetch(API + "/admin/timetable/generate", {
    method: "POST"
  });

  const data = await res.json();
  const list = document.getElementById("timetableList");

  if (!list) return;

  list.innerHTML = "";

  data.forEach(t => {
    const div = document.createElement("div");
    div.textContent = "Timetable ID " + t.id;
    list.appendChild(div);
  });
}
