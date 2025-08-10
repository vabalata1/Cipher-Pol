const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');
const expressLayouts = require('express-ejs-layouts');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const csrf = require('csurf');

const { ensureAuthenticated } = require('./middleware/ensureAuth');
const initPassport = require('./auth/passport');
const { getDatabase } = require('./config/database');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const missionRoutes = require('./routes/missions');
const rumorRoutes = require('./routes/rumors');
const fileRoutes = require('./routes/files');
const indexRoutes = require('./routes');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const DEFAULT_PERSIST_ROOT = fs.existsSync('/var/data') ? '/var/data' : path.join(__dirname, '..');
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(DEFAULT_PERSIST_ROOT, 'uploads'));
const DISABLE_DB = process.env.DISABLE_DB === '1' || process.env.DISABLE_DB === 'true';
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(DEFAULT_PERSIST_ROOT, 'data'));
const getSQLiteStore = () => {
  if (DISABLE_DB) return null;
  // Lazy require to avoid loading sqlite3 in environments without native module
  const SQLiteStore = require('connect-sqlite3')(session);
  return new SQLiteStore({ db: 'sessions.sqlite', dir: DATA_DIR });
};

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

initPassport(passport);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Security middlewares
app.use(helmet());
const limiter = rateLimit({ windowMs: 60 * 1000, max: 200 });
app.use(limiter);

// Static files
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' },
    store: getSQLiteStore() || undefined,
  })
);

// Passport
app.use(passport.initialize());
app.use(passport.session());

// CSRF (disable for Socket.io, JSON APIs and multipart/form-data uploads handled by multer)
const csrfProtection = csrf();
app.use((req, res, next) => {
  // Skip CSRF for API-style JSON requests and socket.io path
  if (req.path.startsWith('/socket.io/')) return next();
  const ctype = req.headers['content-type'] || '';
  if (req.method === 'POST' && (ctype.includes('application/json') || ctype.includes('multipart/form-data'))) return next();
  return csrfProtection(req, res, next);
});

// Expose helpers to views
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.csrfToken = req.csrfToken ? (() => {
    try { return req.csrfToken(); } catch { return null; }
  })() : null;
  next();
});

// Routes
app.use('/', authRoutes);
app.use('/', indexRoutes);
app.use('/chat', ensureAuthenticated, chatRoutes);
app.use('/missions', ensureAuthenticated, missionRoutes);
app.use('/rumors', ensureAuthenticated, rumorRoutes);
app.use('/files', ensureAuthenticated, fileRoutes);
app.use('/users', ensureAuthenticated, require('./routes/users'));
app.use('/communications', ensureAuthenticated, require('./routes/communications'));
app.use('/cipher', ensureAuthenticated, require('./routes/cipher'));

// Socket.io chat
io.use((socket, next) => {
  // Simple auth via query code (MR.x) in this MVP; in production, integrate with session middleware
  const code = socket.handshake.auth && socket.handshake.auth.code;
  if (!code) return next(new Error('Unauthorized'));
  socket.data.code = code;
  next();
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.data.code);
  socket.on('chat:message', async (payload) => {
    const { content } = payload || {};
    if (!content || typeof content !== 'string') return;
    const createdAt = new Date().toISOString();
    console.log('Broadcast message from', socket.data.code, ':', content.trim());
    io.emit('chat:new', { code: socket.data.code, content: content.trim(), createdAt });
  });
  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.data.code);
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Introuvable' });
});

const start = async () => {
  if (!DISABLE_DB) {
    await getDatabase();
  }
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT} (DISABLE_DB=${DISABLE_DB})`);
  });
};

start();


