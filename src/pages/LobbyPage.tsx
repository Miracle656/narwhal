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

    // Poll Game Object
    const { data: gameObj } = useSuiClientQuery(
        'getObject',
        {
            id: gameId || '',
            options: { showContent: true }
        },
        {
            refetchInterval: 2000, // Poll every 2s
            enabled: !!gameId
        }
    );

    const matchState = (gameObj?.data?.content as any)?.fields;
    const players: string[] = matchState?.players || [];
    const host = matchState?.host;
    const gameState = matchState?.state; // 0=Waiting, 1=Active, 2=Ended

    useEffect(() => {
        if (gameState === 1) { // ACTIVE
            navigate(`/game/${gameId}`);
        }
    }, [gameState, navigate, gameId]);

    const handleStartGame = async () => {
        if (!gameId) return;
        setIsStarting(true);
        const tx = new Transaction();
        tx.moveCall({
            target: `${PACKAGE_ID}::game::start_game`,
            arguments: [tx.object(gameId)]
        });

        signAndExecuteTransaction(
            { transaction: tx as any },
            {
                onSuccess: () => {
                    toast.success("Game Started! Deploying...");
                },
                onError: (e) => {
                    console.error("Start failed", e);
                    toast.error("Failed to start game");
                    setIsStarting(false);
                }
            }
        );
    };

    // Robust Host Check
    const isHost = account?.address && host && account.address.toLowerCase() === host.toLowerCase();

    // Debug / Visual feedback for host status
    useEffect(() => {
        if (isHost) {
            console.log("Current user detected as HOST");
        }
    }, [isHost]);

    return (
        <div className="min-h-screen p-8 pt-24">
            <header className="mb-8 border-b border-narwhal-cyan pb-4 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-bold text-white">LOBBY // <span className="text-narwhal-lime">{gameId?.slice(0, 6)}...</span></h1>
                    <p className="text-narwhal-cyan animate-pulse">
                        {gameState === 0 ? "WAITING FOR OPERATIVES..." : "MISSION ACTIVE - DEPLOYING..."}
                    </p>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                        <div className="text-2xl font-mono text-white">{players.length}</div>
                        <div className="text-xs text-gray-400">OPERATIVES</div>
                    </div>

                    {isHost && gameState === 0 && (
                        <button
                            onClick={handleStartGame}
                            disabled={isStarting}
                            className="bg-narwhal-lime text-narwhal-bg font-black px-6 py-2 hover:bg-white uppercase tracking-wider text-sm"
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
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {players.map((p, i) => (
                    <div key={i} className="bg-narwhal-card border border-white/10 p-2 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                        {/* Generate deterministic DNA from address char codes */}
                        <div className="scale-75 origin-top">
                            <AvatarRenderer
                                dna={[p.charCodeAt(2) % 5, p.charCodeAt(3) % 10, p.charCodeAt(4) % 10, p.charCodeAt(5) % 10]}
                                className="w-32 h-32"
                            />
                        </div>
                        <span className="text-xs font-mono mt-2 text-gray-300 truncate w-full text-center">
                            {p === account?.address ? "(YOU)" : p.slice(0, 6) + '...'}
                        </span>
                    </div>
                ))}

                {players.length === 0 && (
                    <div className="col-span-full text-center text-gray-500 font-mono py-12">
                        [ NO SIGNAL DETECTED ]
                    </div>
                )}
            </div>

            <div className="fixed bottom-4 right-4 text-[10px] text-gray-600 font-mono">
                REFRESH_RATE: 2000MS // SYNC_STATUS: NOMINAL
            </div>
        </div>
    );
}
