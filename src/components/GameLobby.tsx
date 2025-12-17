import { useState } from 'react';
import { useEnokiFlow } from '@mysten/enoki/react'; // Assuming Enoki flow for transactions
import { Transaction } from '@mysten/sui/transactions'; // New SDK
import { cn } from '../lib/utils';
import { PACKAGE_ID } from '../constants';

export default function GameLobby() {
    const flow = useEnokiFlow();
    const [prize, setPrize] = useState("1000000000"); // 1 SUI
    const [winnersConfig, setWinnersConfig] = useState("1");
    const [isCreating, setIsCreating] = useState(false);

    const createGame = async () => {
        setIsCreating(true);
        try {
            const tx = new Transaction();
            const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(prize)]);

            tx.moveCall({
                target: `${PACKAGE_ID}::game::create_game`,
                arguments: [
                    coin,
                    tx.pure.u8(parseInt(winnersConfig)),
                ]
            });

            await (flow as any).sponsorAndExecuteTransactionBlock({ transactionBlock: tx as any });

            alert("Game Created!");
        } catch (e) {
            console.error(e);
            alert("Failed to create game");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-4">
            <h1 className="text-4xl font-bold mb-8 text-narwhal-lime">TERMINAL // GAME LOBBY</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Create Game Panel */}
                <div className="bg-narwhal-card border-brutal p-6">
                    <h2 className="text-2xl mb-4 text-white">INITIALIZE POOL</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs mb-1 text-gray-400">PRIZE AMOUNT (MIST)</label>
                            <input
                                type="text"
                                value={prize}
                                onChange={(e) => setPrize(e.target.value)}
                                className="w-full bg-narwhal-bg border border-narwhal-cyan p-2 text-white font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-xs mb-1 text-gray-400">WINNERS CONFIG</label>
                            <div className="flex gap-4">
                                {['1', '2', '3'].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => setWinnersConfig(num)}
                                        className={cn(
                                            "flex-1 p-2 border border-narwhal-cyan hover:bg-narwhal-cyan/10 transition",
                                            winnersConfig === num ? "bg-narwhal-cyan text-narwhal-bg font-bold" : "text-gray-400"
                                        )}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={createGame}
                            disabled={isCreating}
                            className="w-full btn-primary py-3 mt-4"
                        >
                            {isCreating ? "DEPLOYING..." : "DEPLOY PROTOCOL"}
                        </button>
                    </div>
                </div>

                {/* Active Pools (Mock List for now) */}
                <div className="bg-narwhal-card border-brutal p-6 opacity-80">
                    <h2 className="text-2xl mb-4 text-white">ACTIVE SIGNALS</h2>
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="border border-white/10 p-2 flex justify-between items-center hover:border-narwhal-lime cursor-pointer">
                                <span className="text-xs">POOL_ID_0x7...{i}</span>
                                <span className="text-narwhal-lime">10 SUI</span>
                            </div>
                        ))}
                        <div className="text-center text-xs text-gray-500 mt-4">SCANNING NETWORK...</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
