function register() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (email && password) {
    localStorage.setItem("user_email", email);
    localStorage.setItem("user_password", password);
    alert("Account created successfully!");
    window.location.href = "login.html";
  } else {
    alert("Please fill in all fields.");
  }
}

function login() {
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;

  if (
    email === localStorage.getItem("user_email") &&
    pass === localStorage.getItem("user_password")
  ) {
    localStorage.setItem("isLoggedIn", "true");
    window.location.href = "dashboard.html";
  } else {
    alert("Invalid Credentials");
  }
}
