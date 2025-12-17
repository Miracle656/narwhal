import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSuiClientQuery, useCurrentAccount } from '@mysten/dapp-kit';
import { toast } from 'sonner';
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

// Simple pseudo-random for consistent "mock" scores across clients
const getDeterministicScore = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Generate a score between 1000 and 4000
    const normalized = Math.abs(hash) % 3000;
    return 1000 + normalized;
};

export default function GamePage() {
    const { gameId } = useParams();
    const navigate = useNavigate();
    const account = useCurrentAccount();

    // Game State
    const [timeLeft, setTimeLeft] = useState(20);
    const [phase, setPhase] = useState<'Question' | 'Leaderboard'>('Question');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [myScore, setMyScore] = useState(0);
    const [leaderboard, setLeaderboard] = useState<{ address: string, score: number }[]>([]);

    // Fetch players for Leaderboard
    const { data: gameObj } = useSuiClientQuery('getObject', {
        id: gameId || '',
        options: { showContent: true }
    });

    const players: string[] = (gameObj?.data?.content as any)?.fields?.players || [];

    useEffect(() => {
        if (phase !== 'Question') return;

        if (timeLeft > 0) {
            const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
            return () => clearInterval(timer);
        } else {
            // Time Out - Advance
            handleNextPhase();
        }
    }, [timeLeft, phase, currentQuestionIndex]);

    const handleNextPhase = () => {
        // Calculate Score for this round if selected
        if (selectedOption !== null && selectedOption === QUESTIONS[currentQuestionIndex].correct) {
            // Score = Base 500 + (TimeLeft * 50)
            const roundScore = 500 + (timeLeft * 50);
            setMyScore(prev => prev + roundScore);
        }

        if (currentQuestionIndex < QUESTIONS.length - 1) {
            // Next Question
            setCurrentQuestionIndex(prev => prev + 1);
            setTimeLeft(20);
            setSelectedOption(null);
            toast.info("NEXT QUESTION INCOMING...");
        } else {
            // End Game
            generateFinalLeaderboard();
            setPhase('Leaderboard');
        }
    };

    const generateFinalLeaderboard = () => {
        // Generate scores for everyone
        const results = players.map(p => {
            // If it's me, use my real score
            // If it's someone else, use deterministic score
            let score;
            if (account && p.toLowerCase() === account.address.toLowerCase()) {
                // Account for the last question score if correct
                score = myScore + (selectedOption === QUESTIONS[currentQuestionIndex].correct && selectedOption !== null ? 500 + timeLeft * 50 : 0);
            } else {
                score = getDeterministicScore((gameId || '') + p);
            }
            return { address: p, score };
        });

        // Sort
        results.sort((a, b) => b.score - a.score);
        setLeaderboard(results);
    };

    const handleOptionSelect = (index: number) => {
        if (selectedOption !== null) return;
        setSelectedOption(index);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 pt-20">
            {phase === 'Question' ? (
                <div className="w-full max-w-4xl relative">
                    {/* Header: Question Counter */}
                    <div className="flex justify-between text-narwhal-cyan font-mono text-sm mb-2">
                        <span>QUESTION {currentQuestionIndex + 1} / {QUESTIONS.length}</span>
                        <span>{timeLeft}s // SCORE: {myScore}</span>
                    </div>

                    {/* Timer Bar */}
                    <div className="w-full h-2 bg-gray-800 mb-8 overflow-hidden relative">
                        <div
                            className="h-full bg-narwhal-lime transition-all duration-1000 ease-linear"
                            style={{ width: `${(timeLeft / 20) * 100}%` }}
                        />
                    </div>

                    <h2 className="text-3xl text-center mb-12 font-bold text-white min-h-[100px] flex items-center justify-center">
                        {QUESTIONS[currentQuestionIndex].text}
                    </h2>

                    {selectedOption === null ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {QUESTIONS[currentQuestionIndex].options.map((ans, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleOptionSelect(i)}
                                    className="p-6 border-brutal hover:bg-narwhal-cyan hover:text-narwhal-bg text-xl font-mono transition-all text-left group active:bg-narwhal-lime"
                                >
                                    <span className="mr-4 text-narwhal-lime group-hover:text-narwhal-bg">0{i + 1} //</span>
                                    {ans}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-6xl mb-4">🦊</div>
                            <h3 className="text-2xl font-black text-narwhal-lime mb-2">QUICK AS A FOX!</h3>
                            <p className="text-gray-400 font-mono tracking-widest">WAITING FOR SLOWPOKES...</p>
                            <div className="mt-8 text-sm text-gray-500 animate-pulse">
                                SYNCING WITH NETWORK...
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="w-full max-w-xl animate-in zoom-in duration-500">
                    <h1 className="text-2xl font-black text-center text-white mb-2">MISSION COMPLETE</h1>
                    <p className="text-center text-narwhal-cyan font-mono text-xs mb-6">LEADERBOARD_STATUS // FINAL</p>

                    <div className="bg-[#0a0f1e] border border-gray-800 rounded-lg overflow-hidden mb-6">
                        {/* Headers */}
                        <div className="grid grid-cols-12 px-4 py-2 border-b border-gray-800 text-gray-500 text-[10px] font-mono uppercase tracking-wider">
                            <div className="col-span-1">#</div>
                            <div className="col-span-1"></div>
                            <div className="col-span-7">Operative</div>
                            <div className="col-span-3 text-right">Score</div>
                        </div>

                        {/* List */}
                        {leaderboard.map((p, i) => (
                            <div key={i} className="grid grid-cols-12 items-center px-4 py-2 border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                                <div className={`col-span-1 font-mono font-bold text-sm ${i === 0 ? 'text-narwhal-lime' : i === 1 ? 'text-cyan-400' : 'text-gray-500'}`}>
                                    {i + 1}
                                </div>
                                <div className="col-span-1 flex justify-center">
                                    <div className="scale-75 origin-center">
                                        <AvatarRenderer dna={[p.address.charCodeAt(2) % 5, p.address.charCodeAt(3) % 10, 2, 8]} className="w-8 h-8" />
                                    </div>
                                </div>
                                <div className="col-span-7 font-mono text-xs text-white truncate pl-2">
                                    {p.address.slice(0, 6)}...{p.address.slice(-4)}
                                    {account && p.address.toLowerCase() === account.address.toLowerCase() && (
                                        <span className="ml-2 text-[10px] text-narwhal-cyan bg-narwhal-cyan/10 px-1 rounded">(YOU)</span>
                                    )}
                                </div>
                                <div className="col-span-3 text-right font-mono text-narwhal-lime text-xs">
                                    {p.score} <span className="text-[10px] text-gray-500">PTS</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                const isWinner = leaderboard.length > 0 && account && leaderboard[0].address.toLowerCase() === account.address.toLowerCase();
                                navigate('/dashboard', { state: { didWin: isWinner, score: myScore } });
                            }}
                            className="flex-1 btn-primary py-3 text-sm"
                        >
                            DASHBOARD
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
