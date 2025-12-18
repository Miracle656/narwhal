import { useState, useEffect } from 'react';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useNavigate } from 'react-router-dom';
import { PACKAGE_ID } from '../constants';
import MintModal from '../components/MintModal';
import { motion, AnimatePresence } from 'framer-motion';

export default function JoinPage() {
    const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
    const navigate = useNavigate();
    const [gameCode, setGameCode] = useState("");
    const [isJoining, setIsJoining] = useState(false);
    const account = useCurrentAccount();
    const { data: ownedObjects, refetch } = useSuiClientQuery(
        'getOwnedObjects',
        {
            owner: account?.address || '',
            filter: {
                StructType: `${PACKAGE_ID}::avatar::Avatar`,
            },
            options: {
                showType: true,
                showContent: true,
            },
        },
        {
            enabled: !!account,
        },
    );

    const [showMint, setShowMint] = useState(false);
    const [showContent, setShowContent] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShowContent(true), 2500);
        return () => clearTimeout(timer);
    }, []);

    // Check for Avatar (Real check)
    useEffect(() => {
        if (account && ownedObjects) {
            // If user has NO objects of type Avatar, show mint
            if (ownedObjects.data.length === 0) {
                setShowMint(true);
            } else {
                setShowMint(false);
            }
        }
    }, [account, ownedObjects]);

    const handleJoin = async () => {
        if (!gameCode) return;
        setIsJoining(true);
        const tx = new Transaction();
        tx.moveCall({
            target: `${PACKAGE_ID}::game::join_game`,
            arguments: [tx.object(gameCode)],
        });

        signAndExecuteTransaction(
            {
                transaction: tx as any,
            },
            {
                onSuccess: () => {
                    navigate(`/lobby/${gameCode}`);
                },
                onError: (e) => {
                    console.error("Join failed:", e);
                    navigate(`/lobby/${gameCode}`);
                }
            }
        );
        setIsJoining(false);
    };

    if (showMint) {
        return <MintModal onMintSuccess={() => { refetch(); setShowMint(false); }} />;
    }

    return (
        <div className="min-h-screen relative overflow-hidden flex flex-col pt-20 pb-10 px-4">
            {/* Bio-Lum Bubbles */}
            <div className="bubbles">
                {[...Array(15)].map((_, i) => (
                    <div
                        key={i}
                        className="bubble"
                        style={{
                            left: `${Math.random() * 100}%`,
                            width: `${10 + Math.random() * 50}px`,
                            height: `${10 + Math.random() * 50}px`,
                            animationDuration: `${10 + Math.random() * 20}s`,
                            animationDelay: `${Math.random() * 5}s`
                        }}
                    />
                ))}
            </div>

            {/* Top Navigation */}
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-50">
                <div className="text-narwhal-lime font-mono text-xl tracking-widest animate-pulse cursor-default">
                    NARWHAL_NET
                </div>
                <div className="flex items-center gap-4">
                    {account && (
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="bg-narwhal-card border-brutal px-6 py-2 text-narwhal-cyan font-bold hover:bg-narwhal-cyan hover:text-narwhal-bg transition-all uppercase tracking-wider"
                        >
                            Dashboard
                        </button>
                    )}
                    <ConnectButton
                        connectText="CONNECT_UPLINK"
                        className="!bg-narwhal-cyan !text-narwhal-bg !font-bold !uppercase !rounded-none !border-2 !border-narwhal-cyan hover:!bg-transparent hover:!text-narwhal-cyan hover:!shadow-neon transition-all"
                    />
                </div>
            </div>

            <AnimatePresence>
                {!showContent ? (
                    <motion.div
                        className="flex-1 flex items-center justify-center z-10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="bg-narwhal-card border-brutal p-8"
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1.5, rotate: 0 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ duration: 1, type: "spring" }}
                        >
                            <div className="w-16 h-16 bg-narwhal-cyan flex items-center justify-center">
                                <span className="text-4xl text-narwhal-bg">🦄</span>
                            </div>
                        </motion.div>
                    </motion.div>
                ) : (
                    <motion.div
                        className="flex-1 flex flex-col items-center justify-center z-10 w-full max-w-4xl mx-auto space-y-12"
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        {/* Header */}
                        <div className="text-center space-y-2">
                            <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-narwhal-cyan to-narwhal-lime tracking-widest drop-shadow-[0_0_10px_rgba(100,255,218,0.5)]">
                                NARWHAL
                            </h1>
                            <p className="text-narwhal-cyan font-mono text-sm tracking-[0.5em] opacity-80">
                                PLAY_TO_LEARN // EVOLVE_TO_EARN
                            </p>
                        </div>

                        {/* Join Interaction */}
                        {!account ? (
                            <div className="text-gray-500 font-mono text-xs tracking-widest mt-8">
                                [ WAITING_FOR_UPLINK ]
                            </div>
                        ) : (
                            <div className="w-full max-w-lg space-y-12">
                                {/* Input Area */}
                                <div className="bg-narwhal-card border-brutal p-2 flex gap-2 shadow-neon transition-all hover:scale-105">
                                    <input
                                        value={gameCode}
                                        onChange={(e) => setGameCode(e.target.value)}
                                        className="flex-1 bg-transparent border-none text-white font-mono text-xl placeholder-gray-600 focus:outline-none px-4 text-center tracking-widest"
                                        placeholder="ENTER_COORDINATES"
                                    />
                                    <button
                                        onClick={handleJoin}
                                        disabled={isJoining}
                                        className="bg-narwhal-lime text-narwhal-bg font-black px-8 py-4 hover:bg-white transition-colors uppercase tracking-widest md:text-xl clip-path-slant"
                                    >
                                        {isJoining ? "..." : "JOIN"}
                                    </button>
                                </div>

                                {/* Recent Activities - Brutalist Grid */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end border-b border-gray-800 pb-2">
                                        <h3 className="text-gray-500 font-mono text-xs tracking-widest">PENDING OPERATIONS</h3>
                                        <span className="text-[10px] text-narwhal-cyan">SYNCED</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="bg-narwhal-card border border-gray-800 p-8 text-center opacity-50">
                                            <div className="text-narwhal-cyan font-mono text-sm tracking-widest animate-pulse">
                                                AWAITING_COORDINATES // SCANNING_NET
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="absolute bottom-4 left-0 w-full text-center text-[10px] text-gray-800 font-mono pointer-events-none">
                SYSTEM_READY // KIOSK_IDLE
            </div>
        </div>
    );
}
