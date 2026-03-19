import { createTRPCReact } from '@trpc/react-query';
import type {} from '@trpc/react-query/shared';
import type { AppRouter } from '../../server/routers/index.js';

export const trpc = createTRPCReact<AppRouter>();
