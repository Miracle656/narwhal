import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSuiClientQuery, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { toast } from 'sonner';
import { PACKAGE_ID } from '../constants';
import AvatarRenderer from '../components/AvatarRenderer';

const QUESTIONS = [
    {
        text: "WHAT IS THE MAXIMUM GAS BUDGET FOR A SUI TRANSACTION?",
        options: ['1000 SUI', '50,000 MIST', '10,000,000,000 MIST', 'UNLIMITED'],
        correct: 2 // 10B Mist
    },
    {
        text: "WHICH CONSENSUS ENGINE DOES SUI USE?",
        options: ['NARWHAL & BULLSHARK', 'PROOF OF WORK', 'TENDERMINT', 'PROOF OF HISTORY'],
        correct: 0
    },
    {
        text: "WHAT IS THE NATIVE LANGUAGE FOR SUI SMART CONTRACTS?",
        options: ['SOLIDITY', 'RUST', 'MOVE', 'TYPESCRIPT'],
        correct: 2
    }
];

export default function GamePage() {
    const { gameId } = useParams();
    const navigate = useNavigate();
    const account = useCurrentAccount();
    const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
    const client = useSuiClient();

    // Game State
    const [timeLeft, setTimeLeft] = useState(20);
    const [phase, setPhase] = useState<'Question' | 'Leaderboard'>('Question');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [myScore, setMyScore] = useState(0);
    const [leaderboard, setLeaderboard] = useState<{ address: string, score: number }[]>([]);
    const [lastCalculatedQuestionIndex, setLastCalculatedQuestionIndex] = useState(-1);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [pendingRoundScore, setPendingRoundScore] = useState(0);

    // Fetch Game Object with auto-refresh
    const { data: gameObj, refetch: refetchGame } = useSuiClientQuery('getObject', {
        id: gameId || '',
        options: { showContent: true }
    });

    const players: string[] = (gameObj?.data?.content as any)?.fields?.players || [];
    const isHost = account && gameObj && (gameObj.data?.content as any)?.fields?.host === account.address;

    // Sync Game State
    useEffect(() => {
        if (!gameObj?.data?.content) return;

        const fields = (gameObj.data.content as any).fields;
        const startTimestamp = Number(fields.start_timestamp_ms);
        if (!startTimestamp || isNaN(startTimestamp)) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const elapsed = now - startTimestamp;
            const ROUND_DURATION_MS = 20000;
            const newIndex = Math.floor(elapsed / ROUND_DURATION_MS);
            const timeInRound = elapsed % ROUND_DURATION_MS;
            const timeLeftSec = Math.max(0, 20 - Math.floor(timeInRound / 1000));
            const isFeedback = timeLeftSec <= 5;

            if (newIndex >= QUESTIONS.length) {
                setPhase('Leaderboard');
                if (!hasSubmitted) {
                    generateFinalLeaderboard();
                }
                clearInterval(interval);
            } else {
                if (newIndex !== currentQuestionIndex) {
                    setCurrentQuestionIndex(newIndex);
                    setSelectedOption(null);
                    setLastCalculatedQuestionIndex(newIndex - 1);
                    console.log("🔄 Round Score Snapshot:", myScore);
                }

                if (isFeedback && lastCalculatedQuestionIndex !== currentQuestionIndex) {
                    console.log("🎯 FEEDBACK PHASE:", {
                        questionIndex: currentQuestionIndex,
                        selectedOption,
                        correctAnswer: QUESTIONS[currentQuestionIndex].correct,
                        isHost,
                        timeLeft: timeLeftSec
                    });

                    if (!isHost && selectedOption !== null && selectedOption === QUESTIONS[currentQuestionIndex].correct) {
                        // Use the score calculated at the moment of click
                        const roundScore = pendingRoundScore;
                        console.log("✅ CORRECT ANSWER! Adding captured score:", roundScore);
                        setMyScore(prev => {
                            const newScore = prev + roundScore;
                            console.log("📊 Score updated:", prev, "→", newScore);
                            return newScore;
                        });
                    } else {
                        console.log("❌ Wrong answer or host - no score added");
                    }
                    setLastCalculatedQuestionIndex(currentQuestionIndex);
                }
                setTimeLeft(timeLeftSec);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [gameObj, currentQuestionIndex, selectedOption, lastCalculatedQuestionIndex, hasSubmitted, isHost]);

    // Auto-refresh game data when on leaderboard
    useEffect(() => {
        if (phase !== 'Leaderboard') return;

        const refreshInterval = setInterval(() => {
            refetchGame();
        }, 2000);

        return () => clearInterval(refreshInterval);
    }, [phase, refetchGame]);

    // Update leaderboard from on-chain scores table (Table<address, u64>)
    useEffect(() => {
        const fetchScores = async () => {
            if (phase === 'Leaderboard' && gameObj?.data?.content) {
                const fields = (gameObj.data.content as any).fields;
                // 'scores' is a Table, so we need its ID to look up dynamic fields
                const scoresTableId = fields.scores?.fields?.id?.id;

                if (!scoresTableId) {
                    console.log("⚠️ No scores table ID found");
                    return;
                }

                console.log("📊 Fetching scores from Table ID:", scoresTableId);

                const newLeaderboard = await Promise.all(players.map(async (p) => {
                    try {
                        // Fetch the dynamic field for this player's address
                        const dof = await client.getDynamicFieldObject({
                            parentId: scoresTableId,
                            name: { type: 'address', value: p }
                        });

                        if (dof.data?.content) {
                            // The value is inside the field object
                            // For a simple u64 value in a Table, the content fields usually has 'value'
                            const val = (dof.data.content as any).fields.value;
                            console.log(`✅ Score found for ${p}:`, val);
                            return { address: p, score: Number(val) };
                        }
                    } catch (e) {
                        // Player hasn't submitted a score yet or not found
                        // console.log(`ℹ️ No score yet for ${p}`);
                    }
                    return { address: p, score: 0 };
                }));

                newLeaderboard.sort((a, b) => b.score - a.score);
                setLeaderboard(newLeaderboard);
            }
        };

        fetchScores();
    }, [gameObj, phase, players, client]);

    const submitScoreToChain = async (finalScore: number) => {
        console.log("🚀 Submitting Score to Chain:", finalScore);
        if (!gameId || !account || hasSubmitted) return;
        setHasSubmitted(true);

        try {
            const tx = new Transaction();
            tx.moveCall({
                target: `${PACKAGE_ID}::game::submit_score`,
                arguments: [tx.object(gameId), tx.pure.u64(finalScore)]
            });
            signAndExecuteTransaction({ transaction: tx as any }, {
                onSuccess: () => {
                    toast.success("Score Secured on Blockchain!");
                    setTimeout(() => refetchGame(), 1000);
                },
                onError: () => toast.error("Score Submission Failed")
            });
        } catch (e) { console.error(e); }
    };

    const handleFinalizeGame = () => {
        if (!gameId || leaderboard.length === 0) return;
        const winners = leaderboard.slice(0, 1).map(x => x.address);
        const tx = new Transaction();
        tx.moveCall({
            target: `${PACKAGE_ID}::game::finalize_game`,
            arguments: [tx.object(gameId), tx.pure.vector('address', winners)]
        });
        signAndExecuteTransaction({ transaction: tx as any }, {
            onSuccess: () => {
                toast.success("Rewards Distributed.");
                navigate('/dashboard', { state: { didWin: winners.includes(account?.address || '') } });
            },
            onError: () => toast.error("Finalization Failed")
        });
    };

    const generateFinalLeaderboard = () => {
        if (account && !isHost) {
            console.log("🏆 Generating Leaderboard with Current Score:", myScore);
            submitScoreToChain(myScore);
        }
    };

    const handleOptionSelect = (index: number) => {
        if (selectedOption !== null || isHost) return;

        // ⚡ FASTEST FINGER FIRST SCORING
        // Calculate score based on EXACT time of click relative to question start
        if (gameObj?.data?.content) {
            const fields = (gameObj.data.content as any).fields;
            const gameStartTime = Number(fields.start_timestamp_ms);
            const ROUND_DURATION_MS = 20000;

            const questionStartTime = gameStartTime + (currentQuestionIndex * ROUND_DURATION_MS);
            const timeTaken = Date.now() - questionStartTime;

            // Base: 150
            // Bonus: Max 600, decays by 30 points per second (0.6 pts per 20ms)
            // Exact Max: 150 + 600 = 750
            // Exact Min (at 20s): 150 + (600 - 600) = 150
            const bonus = Math.max(0, 600 - Math.floor((timeTaken / 1000) * 30));
            const exactScore = 150 + bonus;

            console.log(`🖱️ CLICKED! Time taken: ${timeTaken}ms | Score locked: ${exactScore}`);
            setPendingRoundScore(exactScore);
        }

        setSelectedOption(index);
    };

    const isInFeedbackWindow = timeLeft <= 5;
    const isCorrect = selectedOption === QUESTIONS[currentQuestionIndex].correct;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 pt-20 relative">
            {!isHost && isInFeedbackWindow && phase === 'Question' && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className={`text-6xl font-black tracking-tighter ${isCorrect ? 'text-narwhal-lime' : 'text-red-500'} border-4 ${isCorrect ? 'border-narwhal-lime' : 'border-red-500'} p-8 transform rotate-[-2deg]`}>
                        {isCorrect ? 'CORRECT // +SCORE' : 'INCORRECT // MISSION FAIL'}
                    </div>
                </div>
            )}

            {phase === 'Question' ? (
                <div className="w-full max-w-4xl relative">
                    <div className="flex justify-between text-narwhal-cyan font-mono text-sm mb-2">
                        <span>QUESTION {currentQuestionIndex + 1} / {QUESTIONS.length}</span>
                        <span>{timeLeft}s // SCORE: {isHost ? 'SPECTATOR' : myScore}</span>
                    </div>

                    <div className="w-full h-2 bg-gray-800 mb-8 overflow-hidden relative">
                        <div
                            className="h-full bg-narwhal-lime transition-all duration-1000 ease-linear"
                            style={{ width: `${(timeLeft / 20) * 100}%` }}
                        />
                    </div>

                    <div className="bg-narwhal-card border-brutal p-8 mb-8 min-h-[200px] flex items-center justify-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 text-9xl text-white font-black group-hover:opacity-10 transition-opacity select-none">?</div>
                        <h2 className="text-2xl md:text-3xl font-bold text-white text-center leading-relaxed max-w-2xl relative z-10">
                            {QUESTIONS[currentQuestionIndex].text}
                        </h2>
                    </div>

                    {selectedOption === null && !isHost ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {QUESTIONS[currentQuestionIndex].options.map((option, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleOptionSelect(idx)}
                                    className={`
                                        p-6 text-left font-mono text-sm border-l-4 transition-all duration-200 relative overflow-hidden
                                        bg-black/40 text-gray-300 border-narwhal-cyan hover:bg-narwhal-cyan/10 hover:border-narwhal-lime hover:pl-8
                                    `}
                                >
                                    <span className="mr-4 opacity-50">0{idx + 1} //</span>
                                    {option}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[200px] flex flex-col justify-center items-center border border-gray-800 bg-black/50 p-8">
                            {isHost ? (
                                <>
                                    <div className="text-4xl mb-4">👁️</div>
                                    <h3 className="text-xl font-bold text-narwhal-lime mb-2">OPERATOR VIEW ACTIVE</h3>
                                    <p className="text-gray-500 font-mono text-sm">MONITORING OPERATIVE PERFORMANCE...</p>
                                    <div className="grid grid-cols-2 gap-4 mt-8 w-full max-w-lg opacity-50 pointer-events-none">
                                        {QUESTIONS[currentQuestionIndex].options.map((opt, i) => (
                                            <div key={i} className={`p-2 border ${i === QUESTIONS[currentQuestionIndex].correct ? 'border-narwhal-lime text-narwhal-lime' : 'border-gray-700 text-gray-600'}`}>
                                                {opt}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-6xl mb-4">🦊</div>
                                    <h3 className="text-2xl font-black text-narwhal-lime mb-2">QUICK AS A FOX!</h3>
                                    <p className="text-gray-400 font-mono tracking-widest">WAITING FOR SLOWPOKES...</p>
                                    <div className="mt-8 text-sm text-gray-500 animate-pulse">
                                        SYNCING WITH NETWORK...
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="w-full max-w-2xl animate-in zoom-in duration-300">
                    <h1 className="text-4xl font-black text-white text-center mb-2 tracking-tighter">MISSION COMPLETE</h1>
                    <p className="text-narwhal-cyan text-center font-mono text-sm mb-8">LEADERBOARD_STATUS // FINAL</p>

                    <div className="bg-narwhal-card border-brutal p-0 overflow-hidden mb-8">
                        <div className="bg-black/50 p-4 flex justify-between text-xs font-mono text-gray-500 border-b border-gray-800">
                            <span>#</span>
                            <span>OPERATIVE</span>
                            <span>SCORE</span>
                        </div>
                        {leaderboard.map((entry, i) => (
                            <div key={i} className={`p-4 flex justify-between items-center border-b border-gray-800 ${entry.address === account?.address ? 'bg-narwhal-cyan/10' : ''}`}>
                                <span className={`font-black ${i === 0 ? 'text-narwhal-lime text-xl' : 'text-gray-500'}`}>{i + 1}</span>
                                <div className="flex items-center gap-3">
                                    <AvatarRenderer dna={[i, i + 1, i + 2, i + 3]} sizeClass="w-8 h-8" className="border border-gray-600" />
                                    <span className="font-mono text-sm text-gray-300">
                                        {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                                        {entry.address === account?.address && <span className="ml-2 text-[10px] bg-narwhal-cyan text-black px-1 rounded">YOU</span>}
                                    </span>
                                </div>
                                <span className="font-mono text-narwhal-lime">{entry.score} PTS</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        {isHost ? (
                            <button
                                onClick={handleFinalizeGame}
                                className="flex-1 bg-narwhal-lime text-black font-bold py-3 text-sm animate-pulse hover:scale-105 transition-transform"
                            >
                                FINALIZE :: DISTRIBUTE REWARDS
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    const isWinner = leaderboard.length > 0 && account && leaderboard[0].address.toLowerCase() === account.address.toLowerCase();
                                    navigate('/dashboard', { state: { didWin: isWinner, score: myScore, gameId } });
                                }}
                                className="flex-1 btn-primary py-3 text-sm"
                            >
                                RETURN TO DASHBOARD
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
