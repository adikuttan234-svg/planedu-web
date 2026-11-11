const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();

const JWT_SECRET = process.env.JWT_SECRET || 'f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8';

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Lightweight In-Memory Rate Limiter for Sensitive Routes
const rateLimits = new Map();
function rateLimiter(maxAttempts, windowMs) {
  return function (req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const key = `${req.path}_${ip}`;
    const now = Date.now();
    const record = rateLimits.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > record.resetAt) {
      record.count = 1;
      record.resetAt = now + windowMs;
    } else {
      record.count++;
    }

    rateLimits.set(key, record);

    if (record.count > maxAttempts) {
      return res.status(429).json({
        message: "Too many attempts. Please try again after a few minutes."
      });
    }
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimits.entries()) {
    if (now > record.resetAt) rateLimits.delete(key);
  }
}, 15 * 60 * 1000);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve Static Frontend Files
const path = require("path");
app.use(express.static(path.join(__dirname, "..")));

// Middleware to authenticate Token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Role Check Helper Middleware
function requireRole(role) {
  return function (req, res, next) {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: "Forbidden: Insufficient privileges" });
    }
    next();
  };
}

// --- DATABASE SWITCHER ---
const USE_LOCAL_DB = process.env.NODE_ENV !== 'production' && !process.env.MONGO_URI;

let User, Faculty, Subject, Schedule, Deadline, Log;

if (USE_LOCAL_DB) {
  console.log("⚠️ USING LOCAL FILE DATABASE (No MongoDB)");
  const LocalDB = require("./utils/LocalDB");
  User = LocalDB.User;
  Faculty = LocalDB.Faculty;
  Subject = LocalDB.Subject;
  Schedule = LocalDB.Schedule;
  Deadline = LocalDB.Deadline;
  Log = LocalDB.Log;

  // Create default admin if not exists
  seedAdminLocal();
} else {
  User = require("./models/User");
  Faculty = require("./models/Faculty");
  Subject = require("./models/Subject");
  Schedule = require("./models/Schedule");
  Deadline = require("./models/Deadline");
  Log = require("./models/Log");

  const mongoURI = process.env.MONGO_URI || "mongodb+srv://adikuttan234:Adithyan4957@cluster0.jxkmpkf.mongodb.net/?appName=Cluster0";
  mongoose.connect(mongoURI)
    .then(async () => {
      console.log("MongoDB Connected");
      await seedAdmin();
    })
    .catch(err => console.log(err));
}

async function seedAdminLocal() {
  const adminEmail = "admin@planedu.com";
  const exists = await User.findOne({ email: adminEmail });
  if (!exists) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await new User({ name: "Admin", email: adminEmail, password: hashedPassword, role: "ADMIN", isApproved: true }).save();
    console.log("Local Admin account seeded");
  }
}
async function seedAdmin() {
  const adminEmail = "admin@planedu.com";
  const exists = await User.findOne({ email: adminEmail });
  if (!exists) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await new User({ name: "Admin", email: adminEmail, password: hashedPassword, role: "ADMIN", isApproved: true }).save();
    console.log("Admin account seeded");
  }
}

async function addLog(user, action, details) {
  try {
    const logData = {
      userId: (user && user.id) || 'system',
      userName: (user && user.name) || 'System',
      action,
      details,
      timestamp: new Date().toISOString()
    };
    const log = new Log(logData);
    await log.save();
  } catch (err) {
    console.error("Log error:", err);
  }
}

app.get("/", (req, res) => {
  res.send("Backend running");
});

/* REGISTER (Hardened against NoSQL injection and Privilege Escalation) */
app.post("/api/auth/register", rateLimiter(15, 15 * 60 * 1000), async (req, res) => {
  try {
    const firstname = typeof req.body.firstname === 'string' ? req.body.firstname.trim() : '';
    const lastname = typeof req.body.lastname === 'string' ? req.body.lastname.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const requestedRole = typeof req.body.role === 'string' ? req.body.role.trim() : '';

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Combine name
    const name = firstname && lastname ? `${firstname} ${lastname}` : (typeof req.body.name === 'string' ? req.body.name.trim() : 'User');

    // CRITICAL SECURITY FIX: Never allow direct registration as ADMIN
    const role = (requestedRole === 'FACULTY' || requestedRole === 'STUDENT') ? requestedRole : 'STUDENT';
    const isApproved = role === 'FACULTY' ? false : true;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email ID is already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ name, email, password: hashedPassword, role, isApproved });
    await newUser.save();

    res.json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ message: "Registration failed: " + error.message });
  }
});

/* LOGIN (Hardened against NoSQL injection) */
app.post("/api/login", rateLimiter(25, 15 * 60 * 1000), async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : null;
    const password = typeof req.body.password === 'string' ? req.body.password : null;

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    let user;
    if (email) {
      user = await User.findOne({ email });
    } else {
      // Superuser password check
      user = await User.findOne({ role: "ADMIN" });
    }

    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // Check Approval
    if (user.isApproved === false) {
      return res.status(403).json({ message: "Account pending administrative approval" });
    }

    const token = jwt.sign(
      { id: user._id, name: user.name, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: "Login successful",
      token: token,
      user: {
        id: user._id,
        name: (user.name || "").toString(),
        role: (user.role || "").toString(),
        email: (user.email || "").toString(),
        profileImg: (user.profileImg || "").toString()
      }
    });

    addLog(user, "LOGIN", `User logged in from ${req.ip}`);
  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
});

/* FACULTY ROUTES */
app.get("/api/faculty", async (req, res) => {
  try {
    const faculty = await Faculty.find();
    res.json(faculty);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post("/api/faculty", authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const newFaculty = new Faculty(req.body);
    await newFaculty.save();
    res.json(newFaculty.data || newFaculty);
    addLog(req.user, "FACULTY_ADD", `Added faculty ${req.body.name}`);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete("/api/faculty/:id", authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    await Faculty.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
    addLog(req.user, "FACULTY_DELETE", `Removed faculty ${req.params.id}`);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.put("/api/faculty/profile", authenticateToken, async (req, res) => {
  try {
    const { profileImg, dept } = req.body;
    // Safely handle missing name/email with defaults
    const name = (req.body && req.body.name ? req.body.name.toString().trim() : "");
    const email = (req.body && req.body.email ? req.body.email.toString().trim() : "");

    if (!req.user || !req.user.name) {
      return res.status(401).json({ message: "Session expired. Please log out and login again to refresh your security token." });
    }
    const tokenName = (req.user.name || "").toString().trim();

    // 1. Update Core User Account (source of truth for profile)
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user.id },
      { name, email, profileImg },
      { upsert: false }
    );

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    // 2. Update Faculty Record (for department/timetable use)
    const faculties = await Faculty.find();

    // Safely find faculty matching the token name
    const targetFac = faculties.find(f => {
      const dbFacName = (f.name || "").toString().toLowerCase().trim();
      const searchName = (tokenName || "").toLowerCase();
      return dbFacName === searchName;
    });

    if (targetFac) {
      await Faculty.findOneAndUpdate(
        { _id: targetFac._id },
        { name: name || targetFac.name, profileImg, dept },
        { upsert: false }
      );
    }

    // 3. Generate a fresh token because the name (used in token payload) might have changed
    const newToken = jwt.sign(
      { id: updatedUser._id, name: updatedUser.name, role: updatedUser.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: "Profile updated successfully",
      token: newToken,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        profileImg: updatedUser.profileImg || ""
      }
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* SUBJECT ROUTES */
app.get("/api/subject", async (req, res) => {
  try {
    const subjects = await Subject.find();
    res.json(subjects);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post("/api/subject", authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const newSubject = new Subject(req.body);
    await newSubject.save();
    res.json(newSubject.data || newSubject);
    addLog(req.user, "SUBJECT_ADD", `Added subject ${req.body.name}`);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ADMIN APPROVAL ROUTES */
app.get("/api/admin/pending-users", authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const users = await User.find({ isApproved: false });
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post("/api/admin/approve-user", authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { userId } = req.body;
    await User.findOneAndUpdate({ _id: userId }, { isApproved: true }, { new: true });
    res.json({ message: "User approved" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete("/api/subject/:id", authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    await Subject.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* SCHEDULE PERSISTENCE ROUTES */
app.post("/api/admin/schedule", authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { sem, scheduleData } = req.body;
    // Update existing or create new
    await Schedule.findOneAndUpdate(
      { sem: sem },
      { sem, scheduleData, createdAt: Date.now() },
      { upsert: true, new: true }
    );
    res.json({ message: "Schedule saved successfully" });
    addLog(req.user, "SCHEDULE_SAVE", `Saved schedule for Semester ${sem}`);
  } catch (err) {
    res.status(500).json({ message: "Failed to save schedule" });
  }
});

app.get("/api/admin/schedule/:sem", async (req, res) => {
  try {
    const schedule = await Schedule.findOne({ sem: req.params.sem });
    if (!schedule) return res.status(404).json({ message: "No schedule found" });
    res.json(schedule.scheduleData);
  } catch (err) {
    res.status(500).json({ message: "Error fetching schedule" });
  }
});

app.get("/api/admin/schedules", async (req, res) => {
  try {
    const schedules = await Schedule.find();
    res.json(schedules);
  } catch (err) { res.status(500).json({ message: "Error fetching schedules" }); }
});

app.get("/api/admin/logs", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.sendStatus(403);
    const logs = await Log.find();
    res.json(logs.reverse().slice(0, 50)); // Last 50 logs
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ADVANCED AI SCHEDULING ENGINE */
app.post("/api/admin/timetable/generate-ai", authenticateToken, async (req, res) => {
  const { sem } = req.body;

  try {
    const allFaculty = await Faculty.find();
    const allSubjects = await Subject.find();
    const allSchedules = await Schedule.find();
    const semSubjects = allSubjects.filter(s => s.sem == sem);

    if (semSubjects.length === 0) {
      return res.status(400).json({ message: "No subjects registered for this semester." });
    }

    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const PERIODS = [1, 2, 3, 4, 5, 6];

    // Tracking current load across ALL schedules
    let loadTracking = {};
    allFaculty.forEach(f => {
      loadTracking[f.name] = 0;
      allSchedules.forEach(s => {
        for (let d in s.scheduleData) {
          for (let p in s.scheduleData[d]) {
            if (s.scheduleData[d][p].teacher === f.name) loadTracking[f.name]++;
          }
        }
      });
    });

    // Subject Tracking for current sem
    let subjectHrsNeeded = {};
    semSubjects.forEach(s => subjectHrsNeeded[s.name] = parseInt(s.weeklyHrs));

    let newSchedule = { Monday: {}, Tuesday: {}, Wednesday: {}, Thursday: {}, Friday: {} };

    // ALGORITHM: Greedy with Conflict Awareness
    for (const day of DAYS) {
      let subjectsToday = [];

      // 1. Assign Labs First (They take 3 hours)
      const labs = semSubjects.filter(s => s.type === 'lab' && subjectHrsNeeded[s.name] >= 3);
      for (const lab of labs) {
        if (subjectHrsNeeded[lab.name] < 3) continue;

        const startSlots = [1, 4]; // Labs must start at p1 or p4
        for (const start of startSlots) {
          let canFit = true;
          for (let p = start; p < start + 3; p++) {
            if (newSchedule[day][p]) { canFit = false; break; }

            // Check cross-sem conflicts
            const hasConflict = allSchedules.some(s => {
              if (s.sem == sem) return false;
              return s.scheduleData[day] && s.scheduleData[day][p] &&
                (s.scheduleData[day][p].teacher === lab.teacher || s.scheduleData[day][p].room === lab.room);
            });
            if (hasConflict) { canFit = false; break; }
          }

          if (canFit && loadTracking[lab.teacher] + 3 <= (allFaculty.find(f => f.name === lab.teacher)?.hours || 0)) {
            for (let p = start; p < start + 3; p++) {
              newSchedule[day][p] = lab;
              subjectHrsNeeded[lab.name]--;
              loadTracking[lab.teacher]++;
            }
            subjectsToday.push(lab.name);
            break;
          }
        }
      }

      // 2. Assign Theory
      for (const p of PERIODS) {
        if (newSchedule[day][p]) continue;

        const availableTheory = semSubjects.filter(s =>
          s.type === 'theory' &&
          subjectHrsNeeded[s.name] > 0 &&
          !subjectsToday.includes(s.name) // Max 1 per day for theory
        );

        // Shuffle for variety
        availableTheory.sort(() => Math.random() - 0.5);

        for (const subj of availableTheory) {
          // Check load
          const fac = allFaculty.find(f => f.name === subj.teacher);
          if (loadTracking[subj.teacher] >= (fac?.hours || 0)) continue;

          // Check cross-sem conflicts
          const hasConflict = allSchedules.some(s => {
            if (s.sem == sem) return false;
            return s.scheduleData[day] && s.scheduleData[day][p] &&
              (s.scheduleData[day][p].teacher === subj.teacher || s.scheduleData[day][p].room === subj.room);
          });

          if (!hasConflict) {
            newSchedule[day][p] = subj;
            subjectHrsNeeded[subj.name]--;
            loadTracking[subj.teacher]++;
            subjectsToday.push(subj.name);
            break;
          }
        }
      }
    }

    res.json({ schedule: newSchedule, success: true });
    addLog(req.user, "AI_GEN", `Generated AI optimized schedule for Semester ${sem}`);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "AI Generation Engine Error: " + err.message });
  }
});

/* BACKUP & RESTORE */
app.get("/api/admin/backup", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.sendStatus(403);
    const Room = USE_LOCAL_DB ? require("./utils/LocalDB").Room : null;
    const LeaveRequest = USE_LOCAL_DB ? require("./utils/LocalDB").LeaveRequest : null;

    const backup = {
      users: await User.find(),
      faculties: await Faculty.find(),
      subjects: await Subject.find(),
      schedules: await Schedule.find(),
      deadlines: await Deadline.find(),
      rooms: await Room ? await Room.find() : [],
      leaveRequests: await LeaveRequest ? await LeaveRequest.find() : []
    };
    res.json(backup);
  } catch (err) { res.status(500).json({ message: "Backup failing: " + err.message }); }
});

app.post("/api/admin/restore", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.sendStatus(403);
    const data = req.body;
    const fs = require('fs');
    const path = require('path');
    const DB_FILE = path.join(__dirname, 'data/db.json');

    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    res.json({ message: "System Restored Successfully" });
  } catch (err) { res.status(500).json({ message: "Restore Failed" }); }
});

/* STRICT CONFLICT CHECK ENDPOINT */
app.post("/api/admin/check-conflict", authenticateToken, async (req, res) => {
  const { teacher, room, day, period, sem, labAssistant } = req.body;

  try {
    const schedules = await Schedule.find();
    let conflict = null;

    for (const sched of schedules) {
      if (sched.sem == sem) continue; // Skip current semester (local check handles this)

      const daySched = sched.scheduleData[day];
      if (!daySched) continue;

      const slot = daySched[period];
      if (!slot) continue;

      // Check Teacher
      if (teacher && slot.teacher === teacher) {
        conflict = `Teacher ${teacher} is busy in Sem ${sched.sem}`;
        break;
      }

      // Check Room
      if (room && room !== 'N/A' && slot.room === room) {
        conflict = `Room ${room} is occupied in Sem ${sched.sem}`;
        break;
      }

      // Check Lab Assistant
      if (labAssistant && slot.labAssistant === labAssistant) {
        conflict = `Assistant ${labAssistant} is busy in Sem ${sched.sem}`;
        break;
      }
    }

    res.json({ conflict: !!conflict, reason: conflict });

  } catch (err) {
    res.status(500).json({ message: "Conflict check failed" });
  }
});

/* ROOM MANAGEMENT */
app.get("/api/rooms", async (req, res) => {
  try {
    const Room = USE_LOCAL_DB ? require("./utils/LocalDB").Room : null;
    const rooms = await Room.find();
    res.json(rooms);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post("/api/rooms", authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const Room = USE_LOCAL_DB ? require("./utils/LocalDB").Room : null;
    const newRoom = new Room(req.body);
    await newRoom.save();
    res.json(newRoom.data || newRoom);
    addLog(req.user, "ROOM_ADD", `Added room ${req.body.name || req.body.number || ''}`);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete("/api/rooms/:id", authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const Room = USE_LOCAL_DB ? require("./utils/LocalDB").Room : null;
    await Room.findByIdAndDelete(req.params.id);
    res.json({ message: "Room deleted" });
    addLog(req.user, "ROOM_DELETE", `Deleted room ${req.params.id}`);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* LEAVE & SUBSTITUTION */
app.post("/api/leave-request", authenticateToken, async (req, res) => {
  try {
    const LeaveRequest = USE_LOCAL_DB ? require("./utils/LocalDB").LeaveRequest : null;
    const request = new LeaveRequest({
      ...req.body,
      facultyId: req.user.id,
      facultyName: req.user.name,
      status: 'pending',
      createdAt: Date.now()
    });
    await request.save();
    res.json({ message: "Leave request submitted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get("/api/admin/pending-leaves", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.sendStatus(403);
    const LeaveRequest = USE_LOCAL_DB ? require("./utils/LocalDB").LeaveRequest : null;
    const leaves = await LeaveRequest.find({ status: 'pending' });
    res.json(leaves);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post("/api/admin/approve-leave", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.sendStatus(403);
    const LeaveRequest = USE_LOCAL_DB ? require("./utils/LocalDB").LeaveRequest : null;
    const { leaveId, status } = req.body;
    await LeaveRequest.findOneAndUpdate({ _id: leaveId }, { status: status });
    res.json({ message: `Leave ${status}` });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get("/api/admin/substitute-suggestions/:leaveId", authenticateToken, async (req, res) => {
  try {
    const LeaveRequest = USE_LOCAL_DB ? require("./utils/LocalDB").LeaveRequest : null;
    const leave = await LeaveRequest.findById(req.params.leaveId);
    if (!leave) return res.status(404).json({ message: "Leave not found" });

    const allFaculty = await Faculty.find();
    const schedules = await Schedule.find();

    // Find who is free on this day/period and hasn't reached their cap
    let suggestions = [];

    for (const fac of allFaculty) {
      if (fac.name === leave.facultyName) continue;

      // Calculate current load
      let currentLoad = 0;
      let isBusy = false;

      schedules.forEach(s => {
        const daySched = s.scheduleData[leave.day];
        if (daySched && daySched[leave.period]) {
          const slot = daySched[leave.period];
          if (slot.teacher === fac.name) isBusy = true;
        }
        // Count total load
        for (let d in s.scheduleData) {
          for (let p in s.scheduleData[d]) {
            if (s.scheduleData[d][p].teacher === fac.name) currentLoad++;
          }
        }
      });

      if (!isBusy && currentLoad < fac.hours) {
        suggestions.push({
          name: fac.name,
          currentLoad,
          maxLoad: fac.hours,
          gap: fac.hours - currentLoad
        });
      }
    }

    res.json(suggestions.sort((a, b) => b.gap - a.gap));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* RED-ZONE LOAD CHECK */
app.get("/api/admin/faculty-load-check/:name", authenticateToken, async (req, res) => {
  try {
    const name = req.params.name;
    const fac = await Faculty.findOne({ name: name });
    if (!fac) return res.json({ load: 0, cap: 0 });

    const schedules = await Schedule.find();
    let load = 0;
    schedules.forEach(s => {
      for (let day in s.scheduleData) {
        for (let p in s.scheduleData[day]) {
          if (s.scheduleData[day][p].teacher === name) load++;
        }
      }
    });

    res.json({ load, cap: fac.hours });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* DEADLINES */
app.post("/api/deadlines", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'FACULTY') {
      return res.status(403).json({ message: "Only administrators and faculty can create deadlines" });
    }
    const newDeadline = new Deadline({
      ...req.body,
      createdAt: Date.now()
    });
    await newDeadline.save();
    res.json(newDeadline.data || newDeadline);
    addLog(req.user, "DEADLINE_ADD", `Created deadline ${req.body.title || ''}`);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get("/api/deadlines/:sem", async (req, res) => {
  try {
    const list = await Deadline.find({ sem: req.params.sem });
    res.json(list);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete("/api/deadlines/:id", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'FACULTY') {
      return res.status(403).json({ message: "Insufficient privileges" });
    }
    await Deadline.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
    addLog(req.user, "DEADLINE_DELETE", `Deleted deadline ${req.params.id}`);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
