import { jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from './trpc.js';
export function TRPCProvider({ children }) {
    const [queryClient] = useState(() => new QueryClient());
    const [trpcClient] = useState(() => trpc.createClient({
        links: [
            httpBatchLink({
                url: '/api',
            }),
        ],
    }));
    return (_jsx(trpc.Provider, { client: trpcClient, queryClient: queryClient, children: _jsx(QueryClientProvider, { client: queryClient, children: children }) }));
}
//# sourceMappingURL=TRPCProvider.js.map