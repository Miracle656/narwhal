type AvatarRendererProps = {
    dna: number[]; // [Skin, Tusk, Eyes, Accessory]
    valueScore?: number;
    className?: string;
    sizeClass?: string;
};

export default function AvatarRenderer({ dna, valueScore = 0, className, sizeClass = "w-64 h-64" }: AvatarRendererProps) {
    // Parsing DNA
    // For this demo, we might only have a few assets. 
    // We map the DNA index to the asset path.
    // In a full game, these would map to thousands of combinations.

    const skinIndex = dna[0] || 0;
    const tuskIndex = dna[1] || 0;
    const eyesIndex = dna[2] || 0;
    const accessoryIndex = dna[3] || 0;

    // Visual Evolution: "Glowing Aura" if value_score > 100
    const isEvolved = valueScore > 100;

    return (
        <div className={`relative ${sizeClass} bg-narwhal-card border-brutal rounded-none overflow-hidden ${className || ''}`}>
            {/* Glow Effect for Evolved Narwhals */}
            {isEvolved && (
                <div className="absolute inset-0 bg-narwhal-lime opacity-20 animate-pulse blur-xl" />
            )}

            {/* Layers */}
            {/* 1. Skin (Base) */}
            <img
                src={`/assets/skin/${skinIndex}.png`}
                alt="Skin"
                className="absolute inset-0 w-full h-full object-cover z-10"
                onError={(e) => { e.currentTarget.src = '/assets/skin/0.png' }} // Fallback
            />

            {/* 2. Eyes */}
            <img
                src={`/assets/eyes/${eyesIndex}.png`}
                alt="Eyes"
                className="absolute inset-0 w-full h-full object-cover z-20 mix-blend-screen"
                onError={(e) => { e.currentTarget.src = '/assets/eyes/0.png' }}
            />

            {/* 3. Tusk */}
            <img
                src={`/assets/tusk/${tuskIndex}.png`}
                alt="Tusk"
                className="absolute inset-0 w-full h-full object-cover z-30"
                onError={(e) => { e.currentTarget.src = '/assets/tusk/0.png' }}
            />

            {/* 4. Accessory */}
            <img
                src={`/assets/accessory/${accessoryIndex}.png`}
                alt="Accessory"
                className="absolute inset-0 w-full h-full object-cover z-40"
                onError={(e) => { e.currentTarget.src = '/assets/accessory/0.png' }}
            />

            {/* Overlay Stats or ID? Optional */}
        </div>
    );
}
