import { createNetworkConfig, SuiClientProvider, WalletProvider } from '@mysten/dapp-kit'
import { getFullnodeUrl } from '@mysten/sui/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EnokiFlowProvider } from '@mysten/enoki/react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ENOKI_API_KEY } from './constants'
import JoinPage from './pages/JoinPage'
import LobbyPage from './pages/LobbyPage'
import GamePage from './pages/GamePage'
import DashboardPage from './pages/DashboardPage'
import { useCurrentAccount } from '@mysten/dapp-kit';
import { Toaster } from 'sonner';

import '@mysten/dapp-kit/dist/index.css'

const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl('testnet') },
})
const queryClient = new QueryClient()

function AppRoutes() {
  const account = useCurrentAccount();
  const location = useLocation();

  // Redirect to join if not connected and trying to access protected routes
  if (!account && location.pathname !== '/join' && location.pathname !== '/' && !location.pathname.startsWith('/lobby')) {
    return <Navigate to="/join" replace />;
  }

  return (
    <>
      <Toaster position="top-center" theme="dark" toastOptions={{
        style: {
          background: '#0a0f1e',
          border: '1px solid #64ffda',
          color: '#fff',
          fontFamily: 'monospace'
        }
      }} />
      <Routes>
        <Route path="/" element={<Navigate to="/join" replace />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/lobby/:gameId" element={<LobbyPage />} />
        <Route path="/game/:gameId" element={<GamePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect={true}>
          <EnokiFlowProvider apiKey={ENOKI_API_KEY}>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </EnokiFlowProvider>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  )
}
