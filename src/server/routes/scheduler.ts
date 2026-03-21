import { Hono } from 'hono';
import { createWeeklyPost } from '../core/post.js';

export const schedulerRoutes = new Hono();

schedulerRoutes.post('/weekly-post', async (c) => {
  const body = await c.req.json<{ name: string }>();
  console.log(`[scheduler] weekly-post task fired: ${body.name}`);

  try {
    const result = await createWeeklyPost();
    console.log(`[scheduler] Weekly post ${result.alreadyExisted ? 'already existed' : 'created'}: ${result.id}`);
    return c.json({}, 200);
  } catch (error) {
    console.error(`[scheduler] Error creating weekly post: ${error}`);
    return c.json({}, 500);
  }
});
