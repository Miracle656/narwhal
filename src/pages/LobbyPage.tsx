import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCurrentAccount, useSuiClientQuery, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { toast } from 'sonner';
import { PACKAGE_ID } from '../constants';
import AvatarRenderer from '../components/AvatarRenderer';

export default function LobbyPage() {
    const { gameId } = useParams();
    const navigate = useNavigate();
    const account = useCurrentAccount();
    const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
    const [isStarting, setIsStarting] = useState(false);

    // Turn-based / Real-time updates
    const { data: gameObj } = useSuiClientQuery(
        'getObject',
        {
            id: gameId || '',
            options: { showContent: true }
        },
        {
            refetchInterval: 2000,
            enabled: !!gameId
        }
    );

    const matchState = (gameObj?.data?.content as any)?.fields;
    const players: string[] = matchState?.players || [];
    const host = matchState?.host;
    const gameState = matchState?.state;

    useEffect(() => {
        if (gameState === 1) {
            navigate(`/game/${gameId}`);
        }
    }, [gameState, navigate, gameId]);

    const handleStartGame = async () => {
        if (!gameId) return;
        setIsStarting(true);
        const tx = new Transaction();
        tx.moveCall({
            target: `${PACKAGE_ID}::game::start_game`,
            arguments: [
                tx.object(gameId),
                tx.object('0x6')
            ]
        });

        signAndExecuteTransaction(
            { transaction: tx as any },
            {
                onSuccess: () => toast.success("Game Started! Deploying..."),
                onError: (e) => {
                    console.error("Start failed", e);
                    toast.error("Failed to start game");
                    setIsStarting(false);
                }
            }
        );
    };

    const isHost = account?.address && host && account.address.toLowerCase() === host.toLowerCase();

    // --- INTERACTIVE LOBBY LOGIC ---
    // State for player positions and movement
    const [targets, setTargets] = useState<Record<string, { x: number, y: number, facingRight: boolean }>>({});

    // Initialize positions when players join
    useEffect(() => {
        if (!players.length) return;

        setTargets(prev => {
            const newTargets = { ...prev };
            players.forEach(p => {
                if (!newTargets[p]) {
                    // Start at random position
                    newTargets[p] = {
                        x: Math.random() * 80 + 10, // 10% to 90%
                        y: Math.random() * 80 + 10,
                        facingRight: Math.random() > 0.5
                    };
                }
            });
            return newTargets;
        });
    }, [players.length]);

    // Autonomous Swim Logic (Drift)
    useEffect(() => {
        const interval = setInterval(() => {
            setTargets(prev => {
                const next = { ...prev };
                Object.keys(next).forEach(key => {
                    // 30% chance to move each tick
                    if (Math.random() > 0.7) {
                        const current = next[key];
                        // Move slightly or completely random
                        const newX = Math.max(10, Math.min(90, current.x + (Math.random() - 0.5) * 40));
                        const newY = Math.max(10, Math.min(90, current.y + (Math.random() - 0.5) * 40));

                        next[key] = {
                            x: newX,
                            y: newY,
                            facingRight: newX > current.x
                        };
                    }
                });
                return next;
            });
        }, 3000); // Update every 3 seconds

        return () => clearInterval(interval);
    }, []);

    const handleLobbyTap = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        // Visual ripple effect could be added here

        // Flock all players to this point with randomness
        setTargets(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(key => {
                const current = next[key];
                // Add randomness so they don't stack perfectly
                const targetX = Math.max(5, Math.min(95, x + (Math.random() - 0.5) * 20));
                const targetY = Math.max(5, Math.min(95, y + (Math.random() - 0.5) * 20));

                next[key] = {
                    x: targetX,
                    y: targetY,
                    facingRight: targetX > current.x
                };
            });
            return next;
        });
    };

    return (
        <div className="min-h-screen relative overflow-hidden bg-black select-none">
            {/* Underwater Background */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#020c1b] via-[#051e3e] to-[#000000] z-0 pointer-events-none" />
            <div className="bubbles z-0 opacity-30 pointer-events-none" />

            <header className="absolute top-0 left-0 right-0 p-4 md:p-8 pt-24 z-20 pointer-events-none">
                <div className="border-b border-narwhal-cyan pb-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-0">
                    <div className="pointer-events-auto">
                        <h1 className="text-2xl md:text-4xl font-bold text-white">LOBBY // <span className="text-narwhal-lime">{gameId?.slice(0, 6)}...</span></h1>
                        <p className="text-narwhal-cyan animate-pulse text-xs md:text-base">
                            {gameState === 0 ? "WAITING FOR OPERATIVES..." : "MISSION ACTIVE - DEPLOYING..."}
                        </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2 pointer-events-auto self-end">
                        <div className="flex items-center gap-2">
                            <div className="text-2xl font-mono text-white">{players.length}</div>
                            <div className="text-xs text-gray-400">OPERATIVES</div>
                        </div>

                        {isHost && gameState === 0 && (
                            <button
                                onClick={handleStartGame}
                                disabled={isStarting}
                                className="bg-narwhal-lime text-narwhal-bg font-black px-6 py-2 hover:bg-white uppercase tracking-wider text-sm shadow-[0_0_15px_rgba(192,255,0,0.5)] transition-all hover:scale-105"
                            >
                                {isStarting ? "INITIATING..." : "START OPERATION"}
                            </button>
                        )}
                        {!isHost && gameState === 0 && (
                            <div className="text-xs text-gray-500 font-mono">
                                WAITING FOR HOST TO INITIATE
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Interactive "Tank" Area */}
            <div
                className="absolute inset-0 z-10 cursor-crosshair active:cursor-grabbing"
                onClick={handleLobbyTap}
            >
                {players.map((p, i) => {
                    const target = targets[p] || { x: 50, y: 50, facingRight: true };

                    return (
                        <div
                            key={i}
                            className="absolute flex flex-col items-center transition-all duration-[3000ms] ease-in-out will-change-transform"
                            style={{
                                left: `${target.x}%`,
                                top: `${target.y}%`,
                                transform: 'translate(-50%, -50%)',
                                zIndex: Math.floor(target.y) // Simple depth sorting by Y position
                            }}
                        >
                            {/* Avatar */}
                            {/* Inner rotation for facing direction + gentle hover bobbing */}
                            <div
                                className="relative transition-transform duration-1000"
                                style={{
                                    transform: `scaleX(${target.facingRight ? 1 : -1})`
                                }}
                            >
                                <div className="animate-float-slow"> {/* Separate bobbing animation */}
                                    <AvatarRenderer
                                        dna={[p.charCodeAt(2) % 5, p.charCodeAt(3) % 10, p.charCodeAt(4) % 10, p.charCodeAt(5) % 10]}
                                        sizeClass="w-24 h-24 md:w-32 md:h-32 lg:w-48 lg:h-48 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]"
                                    />
                                </div>

                                {/* Host Crown/Indicator if needed */}
                                {host && p.toLowerCase() === host.toLowerCase() && (
                                    <div className="absolute -top-6 right-1/2 translate-x-1/2 text-2xl animate-bounce filter drop-shadow-glow" style={{ transform: target.facingRight ? '' : 'scaleX(-1)' }}>
                                        👑
                                    </div>
                                )}
                            </div>

                            {/* Tag & Address - Always upright */}
                            <div className="mt-[-20px] bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-4 py-1 flex items-center gap-2 shadow-xl hover:bg-narwhal-card/80 hover:border-narwhal-cyan/50 transition-colors pointer-events-auto">
                                <span className={`w-2 h-2 rounded-full ${p === account?.address ? 'bg-narwhal-lime animate-pulse' : 'bg-narwhal-cyan'}`} />
                                <span className="text-xs font-mono text-gray-200 tracking-wider">
                                    {p === account?.address ? "YOU" : `${p.slice(0, 4)}...${p.slice(-4)}`}
                                </span>
                            </div>
                            {/* Base Tag (e.g. "BASE #1234") - User requested keep base tag */}
                            <div className="hidden md:block mt-1 text-[10px] font-mono text-narwhal-cyan/60 tracking-widest uppercase">
                                BASE #{p.charCodeAt(0) * 100 + p.charCodeAt(1)}
                            </div>
                        </div>
                    );
                })}

                {players.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-narwhal-cyan/30 font-mono animate-pulse pointer-events-none text-center p-4">
                        <div className="text-4xl md:text-6xl mb-4">⚓</div>
                        <div className="text-sm md:text-base">WAITING FOR OPERATIVES TO SURFACE...</div>
                        <div className="text-xs mt-4 opacity-50">(TAP SCREEN TO GUIDE SWARM)</div>
                    </div>
                )}
            </div>

            <div className="fixed bottom-4 right-4 text-[10px] text-gray-600 font-mono z-20 pointer-events-none">
                SYSTEM STATUS: ONLINE // TAP_TO_GUIDE_SWARM_ENABLED
            </div>
        </div>
    );
}
