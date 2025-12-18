import { useState, useEffect } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient, useSuiClientQuery } from '@mysten/dapp-kit';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PACKAGE_ID } from '../constants';
import AvatarRenderer from '../components/AvatarRenderer';
import { useRef } from 'react';
import { uploadToWalrus } from '../utils/walrus';

export default function DashboardPage() {
    const account = useCurrentAccount();
    const client = useSuiClient();
    const location = useLocation();
    const navigate = useNavigate();
    const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

    const [pendingReward, setPendingReward] = useState<{ gameId: string, amount: number } | null>(null);
    const [isClaiming, setIsClaiming] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [createdGameId, setCreatedGameId] = useState<string | null>(null);
    const [checkRewardId, setCheckRewardId] = useState("");
    const [joinGameId, setJoinGameId] = useState("");
    const [rewardStatusMsg, setRewardStatusMsg] = useState<string | null>(null);
    const [isEvolving, setIsEvolving] = useState(false);
    const [isSnapshotting, setIsSnapshotting] = useState(false);
    const avatarRef = useRef<HTMLDivElement>(null);

    const handleSnapshot = async () => {
        if (!avatarRef.current || !userAvatarId) return;
        setIsSnapshotting(true);
        try {
            console.log("Starting snapshot...");
            const { toBlob } = await import('html-to-image');

            const blob = await toBlob(avatarRef.current, {
                quality: 0.95,
                backgroundColor: 'transparent',
                style: { transform: 'scale(1)' }
            });

            if (!blob) throw new Error("Snapshot failed to create Blob");

            console.log("Snapshot success:", blob);

            const blobId = await uploadToWalrus(blob);
            if (!blobId) throw new Error("Upload to Walrus failed");

            const tx = new Transaction();
            tx.moveCall({
                target: `${PACKAGE_ID}::avatar::set_image_blob_id`,
                arguments: [
                    tx.object(userAvatarId),
                    tx.pure.string(blobId)
                ]
            });

            signAndExecuteTransaction({ transaction: tx as any }, {
                onSuccess: () => {
                    toast.success("Avatar Saved to Chain!");
                    setIsSnapshotting(false);
                    if (refetchAvatar) refetchAvatar();
                },
                onError: (e) => {
                    toast.error("Save to Chain Failed");
                    console.error(e);
                    setIsSnapshotting(false);
                }
            });

        } catch (e) {
            console.error("Snapshot error:", e);
            toast.error("Snapshot Failed");
            setIsSnapshotting(false);
        }
    };

    // Fetch User's Avatar for Claiming & Stats
    const { data: ownedObjects, refetch: refetchAvatar } = useSuiClientQuery(
        'getOwnedObjects',
        {
            owner: account?.address || '',
            filter: { StructType: `${PACKAGE_ID}::avatar::Avatar` },
            options: { showContent: true }
        },
        { enabled: !!account }
    );

    // Parse Avatar Data
    const avatarObj = ownedObjects?.data?.[0]?.data;
    const userAvatarId = avatarObj?.objectId;
    const avatarFields = (avatarObj?.content as any)?.fields;

    const avatarData = {
        dna: avatarFields?.dna ? (avatarFields.dna as number[]) : [0, 0, 0, 0],
        valueScore: avatarFields?.value_score ? Number(avatarFields.value_score) : 0,
        lockedBalance: avatarFields?.locked_balance ? Number(avatarFields.locked_balance) : 0,
        level: avatarFields?.level ? Number(avatarFields.level) : 0,
    };

    // Evolution Logic
    const nextLevelThreshold = (avatarData.level + 1) * 10;
    const canEvolve = avatarData.level < 3 && avatarData.valueScore >= nextLevelThreshold;

    const handleEvolve = async () => {
        if (!userAvatarId || !canEvolve) return;
        setIsEvolving(true);
        try {
            const tx = new Transaction();
            tx.moveCall({
                target: `${PACKAGE_ID}::avatar::evolve_avatar`,
                arguments: [tx.object(userAvatarId)],
            });

            signAndExecuteTransaction(
                { transaction: tx as any },
                {
                    onSuccess: () => {
                        toast.loading("EVOLUTION IN PROGRESS...", { duration: 2000 });
                        setTimeout(() => {
                            toast.success("EVOLUTION COMPLETE! SYSTEM UPGRADED.");
                            if (refetchAvatar) refetchAvatar();
                        }, 2000);
                    },
                    onError: () => toast.error("Evolution Failed")
                }
            );
        } catch (e) {
            console.error(e);
        } finally {
            setIsEvolving(false);
        }
    };

    const formatBalance = (mist: number) => {
        return (mist / 1_000_000_000).toFixed(2);
    };

    const checkRewardForGame = async (targetGameId: string) => {
        if (!account || !targetGameId) return;
        setRewardStatusMsg("SCANNING_DATABASE...");
        setPendingReward(null);

        try {
            console.log("🔍 Checking rewards for:", targetGameId);
            const gameData = await client.getObject({
                id: targetGameId,
                options: { showContent: true }
            });

            if (gameData.error) {
                setRewardStatusMsg("ERROR: OPERATION_ID_NOT_FOUND");
                return;
            }

            const fields = (gameData.data?.content as any)?.fields;
            const pendingRewardsTableId = fields?.pending_rewards?.fields?.id?.id;

            if (!pendingRewardsTableId) {
                setRewardStatusMsg("ERROR: INVALID_OPERATION_DATA");
                return;
            }

            // Check if our address is in the table via Dynamic Field
            try {
                const dof = await client.getDynamicFieldObject({
                    parentId: pendingRewardsTableId,
                    name: { type: 'address', value: account.address }
                });

                if (dof.data?.content) {
                    const amount = (dof.data.content as any).fields.value;
                    setPendingReward({ gameId: targetGameId, amount: Number(amount) });
                    setRewardStatusMsg(null); // Clear msg if found, UI will show card
                    toast.success(`REWARD FOUND: ${amount} MIST`);
                }
            } catch (err) {
                console.log("User not in pending rewards");
                // Only show error if checking manually
                setRewardStatusMsg("NO_ACTIVE_REWARD_FOUND. (ALREADY_CLAIMED_OR_MISSION_FAILED)");
            }

        } catch (e) {
            console.error("Error checking reward:", e);
            setRewardStatusMsg("SYSTEM_ERROR_DURING_SCAN");
        }
    };

    useEffect(() => {
        if (location.state && (location.state as any).gameId) {
            checkRewardForGame((location.state as any).gameId);
        }
    }, [location, account, client]);

    const handleCreateGame = async () => {
        setIsCreating(true);
        try {
            const tx = new Transaction();
            const [prizeCoin] = tx.splitCoins(tx.gas, [100000000]); // 0.1 SUI Prize

            tx.moveCall({
                target: `${PACKAGE_ID}::game::create_game`,
                arguments: [
                    prizeCoin,
                    tx.pure.u8(1), // winners_config: 1 winner for simple mock
                ]
            });

            signAndExecuteTransaction(
                { transaction: tx as any },
                {
                    onSuccess: async (result) => {
                        toast.info("Game Initializing... Fetching ID");
                        console.log("Game Created, fetching details for:", result.digest);
                        try {
                            const txDetails = await client.waitForTransaction({
                                digest: result.digest,
                                options: {
                                    showObjectChanges: true,
                                    showEffects: true
                                }
                            });

                            // Attempt to find the created GamePool object
                            const created = txDetails.objectChanges?.find(
                                (change) => change.type === 'created' && change.objectType.includes('::game::GamePool')
                            );

                            if (created && 'objectId' in created) {
                                setCreatedGameId(created.objectId);
                                toast.success("Game Created Successfully! Share the ID.");
                            } else {
                                toast.warning("Game Created via Tx, but ID lookup failed. Check Explorer.");
                            }
                        } catch (err) {
                            console.error("Error fetching tx details", err);
                            toast.error("Game Created, but failed to fetch details. Check Wallet.");
                        }
                    },
                    onError: (e) => {
                        console.error("Create failed", e);
                        toast.error("Failed to create game");
                    }
                }
            );
        } catch (e) {
            console.error(e);
            toast.error("An error occurred");
        } finally {
            setIsCreating(false);
        }
    };

    const handleJoinGame = async () => {
        if (!joinGameId) {
            toast.error("Please enter coordinates (Game ID)");
            return;
        }
        setIsJoining(true);
        try {
            const tx = new Transaction();
            tx.moveCall({
                target: `${PACKAGE_ID}::game::join_game`,
                arguments: [tx.object(joinGameId)],
            });

            signAndExecuteTransaction(
                { transaction: tx as any },
                {
                    onSuccess: () => {
                        toast.success("ACCESS GRANTED. ENTERING LOBBY.");
                        navigate(`/lobby/${joinGameId}`);
                    },
                    onError: (e) => {
                        console.error("Join failed:", e);
                        toast.error("Join Failed: Game might be active or full.");
                        // Optional: Navigate anyway if user insists they are already joined
                        // navigate(`/lobby/${joinGameId}`); 
                    }
                }
            );
        } catch (e) {
            console.error(e);
            toast.error("Transaction Error");
        } finally {
            setIsJoining(false);
        }
    };

    const handleClaim = async () => {
        if (!account || !pendingReward || !userAvatarId) {
            if (!userAvatarId) toast.error("Avatar Not Found! Cannot claim.");
            return;
        }
        setIsClaiming(true);
        try {
            const tx = new Transaction();
            tx.moveCall({
                target: `${PACKAGE_ID}::game::claim_reward`,
                arguments: [
                    tx.object(pendingReward.gameId),
                    tx.object(userAvatarId)
                ]
            });

            signAndExecuteTransaction(
                { transaction: tx as any },
                {
                    onSuccess: () => {
                        toast.success("REWARD CLAIMED! FUNDS & XP RECEIVED.");
                        setPendingReward(null);
                    },
                    onError: (e) => {
                        console.error("Claim failed", e);
                        toast.error("Claim Transaction Failed");
                    }
                }
            );

        } catch (e) {
            console.error(e);
            toast.error("Claim failed");
        } finally {
            setIsClaiming(false);
        }
    };

    return (
        <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto pt-24 z-10 relative">
            <h1 className="text-2xl md:text-4xl font-black text-white mb-8 border-l-4 border-narwhal-lime pl-4 break-words">OPERATOR_DASHBOARD</h1>

            {/* Create & Join Game Section */}
            <div className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Create Game */}
                <div className="bg-narwhal-card border-brutal p-6 md:p-8 shadow-neon flex flex-col justify-between">
                    <div>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-2">
                            <div>
                                <h2 className="text-xl md:text-2xl font-mono text-white">INITIATE_OPERATION</h2>
                                <p className="text-gray-400 text-sm">Create a new game lobby.</p>
                            </div>
                            <div className="text-narwhal-cyan font-mono text-xs border border-narwhal-cyan px-2 py-1 self-start md:self-auto">
                                0.1 SUI
                            </div>
                        </div>
                        {createdGameId ? (
                            <div className="bg-black/50 p-4 border border-narwhal-lime flex justify-between items-center gap-4 mb-4">
                                <div className="flex-1 overflow-hidden">
                                    <div className="text-xs text-narwhal-lime mb-1">OPERATION_ID</div>
                                    <div className="font-mono text-sm text-white truncate">{createdGameId}</div>
                                </div>
                                <button onClick={() => { navigator.clipboard.writeText(createdGameId); toast.success("Copied!"); }} className="text-gray-400 hover:text-white">
                                    📋
                                </button>
                            </div>
                        ) : null}
                    </div>

                    {createdGameId ? (
                        <button
                            onClick={() => navigate(`/lobby/${createdGameId}`)}
                            className="bg-narwhal-cyan text-black font-bold w-full py-3 hover:bg-narwhal-lime transition-colors text-sm uppercase tracking-wider"
                        >
                            ENTER LOBBY
                        </button>
                    ) : (
                        <button
                            onClick={handleCreateGame}
                            disabled={isCreating}
                            className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2"
                        >
                            {isCreating ? "INITIALIZING..." : "+ NEW OPERATION"}
                        </button>
                    )}
                </div>

                {/* Join Game */}
                <div className="bg-narwhal-card border-brutal p-6 md:p-8 shadow-neon flex flex-col justify-between">
                    <div>
                        <h2 className="text-2xl font-mono text-white mb-2">JOIN_OPERATION</h2>
                        <p className="text-gray-400 text-sm mb-6">Enter existing operation coordinates.</p>

                        <input
                            value={joinGameId}
                            onChange={(e) => setJoinGameId(e.target.value)}
                            placeholder="ENTER_OPERATION_ID"
                            className="w-full bg-black/50 border border-narwhal-cyan p-4 text-white font-mono text-lg placeholder-gray-600 focus:outline-none focus:border-narwhal-lime transition-colors text-center"
                        />
                    </div>
                    <button
                        onClick={handleJoinGame}
                        disabled={isJoining}
                        className="bg-gray-800 text-white font-bold w-full py-4 mt-6 hover:bg-white hover:text-black transition-colors text-lg uppercase tracking-wider"
                    >
                        {isJoining ? "ESTABLISHING UPLINK..." : "JOIN MISSION"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Avatar Stat Card */}
                <div className="md:col-span-1 bg-narwhal-card border-brutal p-6 flex flex-col items-center shadow-lime relative">
                    <h2 className="text-narwhal-cyan font-mono text-xs mb-4 w-full text-left"> AVATAR_STATUS</h2>

                    <div className="relative">
                        <AvatarRenderer
                            ref={avatarRef}
                            dna={avatarData.dna}
                            level={avatarData.level}
                            className={`border-2 border-narwhal-lime w-full max-w-[250px] aspect-square ${canEvolve ? 'opacity-50' : ''}`}
                            sizeClass="w-full h-full"
                        />

                        {canEvolve && (
                            <div className="absolute inset-0 flex items-center justify-center z-50">
                                <button
                                    onClick={handleEvolve}
                                    disabled={isEvolving}
                                    className="bg-narwhal-lime text-black font-black px-6 py-4 animate-bounce hover:scale-110 transition-transform uppercase tracking-widest shadow-[0_0_20px_rgba(192,255,0,0.8)]"
                                >
                                    {isEvolving ? "EVOLVING..." : "EVOLVE!"}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Snapshot Button */}
                    <button
                        onClick={handleSnapshot}
                        disabled={isSnapshotting || isEvolving}
                        className="mt-4 w-full bg-transparant border border-narwhal-cyan text-narwhal-cyan hover:bg-narwhal-cyan hover:text-black py-2 text-[10px] font-mono tracking-wider transition-colors uppercase disabled:opacity-50"
                    >
                        {isSnapshotting ? "UPLOADING TO WALRUS..." : "📸 SAVE IMAGE TO WALLET"}
                    </button>

                    <div className="w-full mt-6 space-y-2 font-mono">
                        <div className="flex justify-between items-center p-2 border border-gray-800">
                            <span className="text-gray-400 text-xs">VALUE_SCORE</span>
                            <div className="flex items-center gap-2">
                                <span className="text-narwhal-lime font-bold">{avatarData.valueScore}</span>
                                {avatarData.level < 3 && (
                                    <span className="text-[10px] text-gray-500">/ {nextLevelThreshold}</span>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-between items-center p-2 border border-gray-800">
                            <span className="text-gray-400 text-xs">LOCKED_LIQ</span>
                            <span className="text-narwhal-cyan font-bold">{formatBalance(avatarData.lockedBalance)} SUI</span>
                        </div>
                    </div>
                </div>
                {/* History & Rewards */}
                <div className="md:col-span-2 space-y-8">
                    {/* Pending Rewards */}
                    <div className="bg-narwhal-card border border-gray-800 p-6">
                        <h3 className="text-white font-mono mb-4 text-sm">CHECK_REWARD_STATUS</h3>
                        <div className="flex gap-2 mb-4">
                            <input
                                value={checkRewardId}
                                onChange={(e) => setCheckRewardId(e.target.value)}
                                placeholder="ENTER_GAME_ID"
                                className="bg-black/50 border border-gray-600 text-white font-mono px-4 py-2 flex-1 text-xs"
                            />
                            <button onClick={() => checkRewardForGame(checkRewardId)} className="bg-gray-700 text-white px-4 py-2 text-xs font-bold hover:bg-narwhal-cyan hover:text-black">
                                SCAN
                            </button>
                        </div>

                        {/* Status Message Area */}
                        {rewardStatusMsg && !pendingReward && (
                            <div className="text-xs font-mono text-narwhal-pink/80 text-center border border-narwhal-pink/30 p-4 animate-pulse uppercase my-4">
                                {rewardStatusMsg}
                            </div>
                        )}

                        {pendingReward && (
                            <div className="bg-narwhal-card border-2 border-narwhal-lime p-8 shadow-[0_0_30px_rgba(192,255,0,0.15)] relative overflow-hidden group animate-in slide-in-from-right">
                                <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl text-narwhal-lime font-black pointer-events-none">
                                    $
                                </div>
                                <div className="flex justify-between items-center mb-6 relative z-10">
                                    <div>
                                        <h3 className="text-2xl font-mono text-white">MISSION_SUCCESS</h3>
                                        <p className="text-narwhal-lime text-sm">REWARD_ALLOCATION_DETECTED</p>
                                    </div>
                                    <div className="text-4xl font-mono text-white border-b-2 border-narwhal-lime pb-1">
                                        {pendingReward.amount} MIST
                                    </div>
                                </div>

                                <button
                                    onClick={handleClaim}
                                    disabled={isClaiming}
                                    className="w-full btn-primary relative z-10"
                                >
                                    {isClaiming ? "PROCESSING..." : "CLAIM_REWARD"}
                                </button>
                                <p className="text-[10px] text-center mt-3 text-gray-500 font-mono relative z-10">
                                    SPLIT: 90% WALLET // 10% NFT_INJECTION
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Operation Log (Real Data) */}
                    <div>
                        <h3 className="text-white font-mono mb-6 text-xl border-b border-gray-800 pb-2">OPERATION_LOG</h3>
                        <div className="space-y-4">
                            <OperationsLog />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Separate component for Real Event Data to keep main component clean
function OperationsLog() {
    const { data: events, isPending } = useSuiClientQuery(
        'queryEvents',
        {
            query: { MoveModule: { package: PACKAGE_ID, module: 'game' } },
            order: 'descending',
            limit: 5
        },
        {
            refetchInterval: 5000
        }
    );

    if (isPending) return <div className="text-gray-500 font-mono text-sm">SCANNING NETWORK...</div>;

    if (!events || events.data.length === 0) {
        return <div className="text-gray-500 font-mono text-sm italic">NO RECENT OPERATIONS_DETECTED</div>;
    }

    // Filter for ScoreSubmitted events specifically if other events exist
    const relevantEvents = events.data.filter(e => e.type.includes('ScoreSubmitted'));

    return (
        <>
            {relevantEvents.map((event, idx) => {
                const parsedJson = event.parsedJson as any;
                const gameIdShort = parsedJson?.game_id ? `${parsedJson.game_id.substring(0, 6)}...` : 'UNKNOWN';
                const score = parsedJson?.score || '0';
                const timeAgo = new Date(Number(event.timestampMs)).toLocaleTimeString();

                return (
                    <div key={idx} className="bg-narwhal-card/50 border border-gray-800 p-4 flex justify-between items-center hover:border-narwhal-cyan transition-colors group">
                        <div className="flex items-center gap-4">
                            <span className="text-narwhal-cyan font-mono text-sm">#{String(idx + 1).padStart(3, '0')}</span>
                            <div>
                                <div className="text-white font-bold font-mono text-sm group-hover:text-narwhal-cyan transition-colors">
                                    OP_ID: {gameIdShort}
                                </div>
                                <div className="text-[10px] text-gray-500 font-mono uppercase">
                                    SCORE_SUBMITTED: {score} // {timeAgo}
                                </div>
                            </div>
                        </div>
                        <div className="border border-narwhal-lime text-narwhal-lime px-2 py-1 text-[10px] font-bold tracking-wider uppercase">
                            LOGGED
                        </div>
                    </div>
                );
            })}
        </>
    );
}
