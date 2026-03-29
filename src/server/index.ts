import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { appRouter } from './routers/index.js';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { menu } from './routes/menu';
import { triggers } from './routes/triggers';
import { schedulerRoutes } from './routes/scheduler';

const app = new Hono();
const internal = new Hono();

internal.route('/menu', menu);
internal.route('/triggers', triggers);
internal.route('/scheduler', schedulerRoutes);

app.use('/api/*', (c) => {
  return fetchRequestHandler({
    endpoint: '/api',
    req: c.req.raw,
    router: appRouter,
    createContext: () => ({})
  });
});
app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
