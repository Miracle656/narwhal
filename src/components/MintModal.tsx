import { useState, useEffect } from 'react';
import AvatarRenderer from './AvatarRenderer';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { cn } from '../lib/utils';
// Package ID should be passed in or imported from config
// For now we use a placeholder that needs to be updated after deployment
import { PACKAGE_ID } from '../constants';

export default function MintModal({ onMintSuccess }: { onMintSuccess?: () => void }) {
    const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
    const [isMinting, setIsMinting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [previewDna, setPreviewDna] = useState([0, 0, 0, 0]);

    // Cycling preview effect
    useEffect(() => {
        const interval = setInterval(() => {
            setPreviewDna([
                Math.floor(Math.random() * 10), // Hue
                Math.floor(Math.random() * 5),  // Skin
                Math.floor(Math.random() * 10), // Tusk
                Math.floor(Math.random() * 10)  // Accessory
            ]);
        }, 200);
        return () => clearInterval(interval);
    }, []);

    const handleMint = async () => {
        setIsMinting(true);
        setError(null);
        try {
            const txb = new Transaction();
            // Assume Testnet Random object 0x8
            // Arg0: Random (0x8), Arg1: Clock (0x6) if needed? No, my contract uses Clock? logic used Random.
            // My contract: entry fun mint_avatar(r: &Random, ctx: &mut TxContext)
            // On Testnet/Mainnet, Random is 0x8

            txb.moveCall({
                target: `${PACKAGE_ID}::avatar::mint_avatar`,
                arguments: [txb.object('0x8')],
            });

            signAndExecuteTransaction(
                {
                    transaction: txb as any,
                },
                {
                    onSuccess: (res) => {
                        console.log("Mint success:", res);
                        if (onMintSuccess) onMintSuccess();
                    },
                    onError: (e) => {
                        console.error(e);
                        setError(e.message || "Mint failed");
                    }
                }
            );

        } catch (e: any) {
            console.error(e);
            setError(e.message || "Mint failed");
        } finally {
            setIsMinting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md p-8 bg-narwhal-card border-brutal relative">
                <h2 className="text-3xl font-bold mb-4 text-center">MINT NARWHAL</h2>
                <p className="text-sm text-center mb-8 text-gray-400">
                    Syncing biometric data... generating DNA sequence.
                </p>

                <div className="flex justify-center mb-8 relative">
                    <AvatarRenderer
                        dna={previewDna}
                        level={0}
                        className="animate-pulse" // Removed sizeClass to default to w-64 h-64
                    />
                    <div className="absolute -bottom-6 text-xs font-mono text-narwhal-lime">
                        DNA_SEQ: {previewDna.join('.')}
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-2 bg-red-900/50 border border-red-500 text-red-100 text-xs">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleMint}
                    disabled={isMinting}
                    className={cn("w-full btn-primary text-xl py-4", isMinting && "opacity-50 cursor-not-allowed")}
                >
                    {isMinting ? "MINTING..." : "INITIATE SEQUENCE"}
                </button>
            </div>
        </div>
    );
}
