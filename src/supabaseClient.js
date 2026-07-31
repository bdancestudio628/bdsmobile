// ═══════════════════════════════════════════════════════════
// Supabase data layer for the student app (UPDATED v5.0)
// Talks to /api/db.js (GET = load whole DB, POST = save whole DB) —
// same "one JSON blob" pattern as the original app's localStorage/Netlify setup.
//
// VALIDATION IMPROVEMENTS:
// - Enhanced input validation for login credentials
// - Better error messages and logging
// - Type checking for data integrity
// - Timeout handling for network failures
// - Data sanitization for security
// ═══════════════════════════════════════════════════════════

let cachedDB = null;
let cachedNid = null; // the admin app's "nid" (next-id counters) — preserved on save so we never clobber it

const LOAD_TIMEOUT = 10000; // 10 seconds for loading data
const SAVE_TIMEOUT = 15000; // 15 seconds for saving data

// Input validation helpers
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }
  const trimmed = username.trim();
  if (trimmed.length < 1) {
    return { valid: false, error: 'Username cannot be empty' };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: 'Username is too long' };
  }
  // Basic alphanumeric + common characters validation
  if (!/^[a-zA-Z0-9._@\-\s]+$/.test(trimmed)) {
    return { valid: false, error: 'Username contains invalid characters' };
  }
  return { valid: true, value: trimmed };
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < 1) {
    return { valid: false, error: 'Password cannot be empty' };
  }
  if (password.length > 255) {
    return { valid: false, error: 'Password is too long' };
  }
  return { valid: true, value: password };
}

function validateDatabase(db) {
  if (!db || typeof db !== 'object') {
    return { valid: false, error: 'Invalid database format' };
  }
  
  // Ensure required arrays exist
  const required = ['students', 'payments', 'classes', 'teachers', 'attendance', 'accounts', 'places', 'rewards'];
  for (const key of required) {
    if (!Array.isArray(db[key])) {
      db[key] = [];
    }
  }
  
  if (typeof db.paymentInfo !== 'object') {
    db.paymentInfo = {};
  }
  
  return { valid: true, value: db };
}

function validateAccount(account) {
  if (!account || typeof account !== 'object') {
    return { valid: false, error: 'Invalid account data' };
  }
  if (!account.user || !account.pass || !account.role) {
    return { valid: false, error: 'Account missing required fields' };
  }
  return { valid: true, value: account };
}

function validateStudent(student) {
  if (!student || typeof student !== 'object') {
    return { valid: false, error: 'Invalid student data' };
  }
  if (!student.id) {
    return { valid: false, error: 'Student missing ID' };
  }
  if (typeof student.name !== 'string') {
    student.name = 'Student';
  }
  if (!Array.isArray(student.rewards)) {
    student.rewards = [];
  }
  if (typeof student.points !== 'number' || student.points < 0) {
    student.points = 0;
  }
  return { valid: true, value: student };
}

// Create a timeout promise that rejects after specified duration
function withTimeout(promise, ms, operationName) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${operationName} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// ── Session token ────────────────────────────────────────────────────
// Held in memory (not localStorage) and attached to every data request. The server returns only the
// public landing-page content without it, so this is what lets a signed-in student see their own
// record. Cleared on sign-out.
let authToken = '';
export function setAuthToken(t) { authToken = t || ''; }
function authHeaders(extra) {
  const h = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
  if (authToken) h['Authorization'] = 'Bearer ' + authToken;
  return h;
}

// Load the entire app database with validation and timeout
export async function loadDB() {
  try {
    const fetchPromise = fetch('/api/db', { headers: authHeaders() });
    const res = await withTimeout(fetchPromise, LOAD_TIMEOUT, 'Database load');
    
    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch (e) {}
      const statusMsg = res.status === 404 ? 'Database not found' : res.status === 500 ? 'Server error' : `HTTP ${res.status}`;
      throw new Error(`${statusMsg}: ${detail || 'Failed to load database'}`);
    }
    
    const json = await res.json();
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid server response format');
    }
    
    const { data } = json;
    let parsed = {};
    
    if (data) {
      if (typeof data !== 'string') {
        throw new Error('Server returned data in unexpected format');
      }
      try { 
        parsed = JSON.parse(data);
      } catch (e) { 
        console.error('JSON parse error:', e);
        parsed = {};
      }
    }
    
    // Validate and normalize the database structure
    const validation = validateDatabase(parsed.db || {});
    if (!validation.valid) {
      console.warn('Database validation:', validation.error);
    }
    
    cachedNid = parsed.nid || null;
    cachedDB = validation.value;
    
    return cachedDB;
  } catch (err) {
    if (err.message.includes('timed out')) {
      throw new Error('Network connection timed out — check your internet and try again');
    }
    if (err.message.includes('Failed to fetch')) {
      throw new Error('Could not reach the server — check your connection');
    }
    throw err;
  }
}

// Save the entire app database back with validation
export async function saveDB(db) {
  try {
    // Validate database before saving
    const validation = validateDatabase(db);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    const payload = JSON.stringify({ db: validation.value, nid: cachedNid || {} });
    
    if (payload.length > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('Database is too large to save');
    }
    
    const fetchPromise = fetch('/api/db', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ data: payload }),
    });
    
    const res = await withTimeout(fetchPromise, SAVE_TIMEOUT, 'Database save');
    
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Failed to save database (HTTP ${res.status}): ${detail || 'Unknown error'}`);
    }
    
    cachedDB = validation.value;
    return true;
  } catch (err) {
    if (err.message.includes('timed out')) {
      throw new Error('Save operation timed out — your changes may not have been saved');
    }
    throw err;
  }
}

// Student login with comprehensive validation
export function studentLogin(db, username, password) {
  // Validate inputs first
  const userValidation = validateUsername(username);
  if (!userValidation.valid) {
    throw new Error(userValidation.error);
  }
  
  const passValidation = validatePassword(password);
  if (!passValidation.valid) {
    throw new Error(passValidation.error);
  }
  
  const cleanUsername = userValidation.value;
  const cleanPassword = passValidation.value;
  
  // Validate database structure
  const dbValidation = validateDatabase(db);
  if (!dbValidation.valid) {
    throw new Error('Database validation failed');
  }
  
  const validDb = dbValidation.value;
  
  // Find matching account with strict comparison
  const acc = (validDb.accounts || []).find(a => 
    a && 
    typeof a.user === 'string' && 
    typeof a.pass === 'string' &&
    a.user === cleanUsername && 
    a.pass === cleanPassword && 
    a.role === 'student'
  );
  
  if (!acc) {
    return null; // Invalid credentials
  }
  
  // Validate account
  const accValidation = validateAccount(acc);
  if (!accValidation.valid) {
    console.error('Account validation failed:', accValidation.error);
    return null;
  }
  
  // Find corresponding student record
  const student = (validDb.students || []).find(s => 
    s && s.id === acc.ref
  );
  
  if (!student) {
    console.error('Student record not found for account:', acc.ref);
    return null;
  }
  
  // Validate student data
  const studentValidation = validateStudent(student);
  if (!studentValidation.valid) {
    console.error('Student validation failed:', studentValidation.error);
    return null;
  }
  
  return {
    account: accValidation.value,
    student: studentValidation.value,
  };
}

// Get account by ID (for session restoration)
export function getAccountById(db, accountId) {
  const dbValidation = validateDatabase(db);
  if (!dbValidation.valid) {
    return null;
  }
  
  const account = (dbValidation.value.accounts || []).find(a => a && a.id === accountId);
  if (!account) {
    return null;
  }
  
  const validation = validateAccount(account);
  return validation.valid ? validation.value : null;
}

// Get student by ID with validation
export function getStudentById(db, studentId) {
  const dbValidation = validateDatabase(db);
  if (!dbValidation.valid) {
    return null;
  }
  
  const student = (dbValidation.value.students || []).find(s => s && s.id === studentId);
  if (!student) {
    return null;
  }
  
  const validation = validateStudent(student);
  return validation.valid ? validation.value : null;
}

// Validate and sanitize reward redemption
export function validateRedemption(db, studentId, rewardId) {
  const dbValidation = validateDatabase(db);
  if (!dbValidation.valid) {
    return { valid: false, error: 'Database error' };
  }
  
  if (!studentId || !rewardId) {
    return { valid: false, error: 'Missing student or reward ID' };
  }
  
  const student = getStudentById(dbValidation.value, studentId);
  if (!student) {
    return { valid: false, error: 'Student not found' };
  }
  
  const reward = (dbValidation.value.rewards || []).find(r => r && r.id === rewardId);
  if (!reward) {
    return { valid: false, error: 'Reward not found' };
  }
  
  if (student.points < reward.cost) {
    return { valid: false, error: 'Insufficient points' };
  }
  
  return { valid: true, student, reward };
}

// Export validation functions for testing/external use
export const validation = {
  validateUsername,
  validatePassword,
  validateDatabase,
  validateAccount,
  validateStudent,
  validateRedemption,
};

// ── Server-side sign-in ──────────────────────────────────────────────
// Asks the server to check the password instead of comparing it in the browser. Returns the parsed
// reply on success, {ok:false} when the credentials are wrong, or null when the server couldn't be
// reached or is still running the older function — the caller then falls back to studentLogin() so a
// partial rollout can't lock students out.
export async function serverLogin(username, password) {
  try {
    const r = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', user: username, pass: password, role: 'student' }),
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    if (!j || typeof j.ok !== 'boolean') return null;
    return j;
  } catch (e) {
    return null;
  }
}
