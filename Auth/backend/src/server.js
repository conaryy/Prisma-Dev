import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { initDb, seedDefaults } from './db.js';
import { initKeys } from './crypto.js';
import { createAdminRouter } from './routes/admin-routes.js';
import { createOauthRouter } from './routes/oauth-routes.js';
import { createPublicRouter } from './routes/public-routes.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || config.allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error('Origin not allowed'));
    },
    credentials: true,
  })
);
app.use(createPublicRouter());
app.use(createAdminRouter());
app.use(createOauthRouter());

app.use((err, _req, res, _next) => {
  res.status(500).json({
    error: 'internal_server_error',
    message: config.isDevelopment ? err?.message || 'Unexpected error' : 'Unexpected error',
  });
});

async function bootstrap() {
  await initDb();
  await seedDefaults();
  await initKeys();
  app.listen(config.port, () => {
    console.log(`[auth-backend] running on ${config.baseUrl}`);
    console.log(`[auth-backend] issuer: ${config.issuer}`);
  });
}

bootstrap().catch((error) => {
  console.error('[auth-backend] bootstrap failed');
  console.error(error);
  process.exit(1);
});
