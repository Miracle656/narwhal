type AvatarRendererProps = {
    dna: number[];
    level?: number;
    className?: string;
    sizeClass?: string;
};

export default function AvatarRenderer({ dna, level = 0, className, sizeClass = "w-64 h-64" }: AvatarRendererProps) {
    // --- CONFIGURATION ZONE ---
    const DEBUG_MODE = false; // <--- SET TO TRUE to see red borders, FALSE to hide them.

    // TWEAK THESE NUMBERS TO FIX THE TUSK:
    const TUSK_TOP = "47%";   // Lower number = Moves Tusk UP
    const TUSK_LEFT = "100%";  // Lower number = Moves Tusk LEFT (deeper into head)
    const TUSK_SIZE = "70%";  // Size of the tusk relative to the head
    // --------------------------

    // --- COLOR MAPPING ---
    // dna[0] -> Tail Hue
    // dna[1] -> Body Hue
    // dna[2] -> Head Hue
    // dna[3] -> Tusk Hue
    const tailHue = (dna[0] || 0) * 36;
    const bodyHue = (dna[1] || 0) * 36;
    const headHue = (dna[2] || 0) * 36;
    const tuskHue = (dna[3] || 0) * 36;

    const LEVEL_NAMES = ["BASE", "CYBER", "MECH", "LEGEND"];
    const LAYERS = ['base', 'cyber', 'mech', 'legend'];

    const renderPartImg = (layerIndex: number, partName: string, className: string) => {
        const layerName = LAYERS[layerIndex];
        const folderName = `${layerName}narwhal`;
        const fileName = `${layerName}${partName}.svg`;

        return (
            <img
                key={`${layerName}-${partName}`}
                src={`/assets/${folderName}/${fileName}`}
                alt={`${layerName} ${partName}`}
                className={className}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                draggable={false}
            />
        );
    };

    return (
        <div className={`relative flex flex-col items-center ${className || ''}`}>

            <div className={`relative ${sizeClass} flex items-center justify-center`}>
                {level >= 2 && (
                    <div className="absolute inset-0 bg-narwhal-lime opacity-20 animate-pulse blur-xl z-0" />
                )}

                <div className="flex items-center justify-center h-3/4">

                    {/* 1. TAIL */}
                    <div className={`relative h-full w-auto flex-shrink-0 z-0 ${DEBUG_MODE ? 'border border-red-500' : ''}`}>
                        <div style={{ filter: `hue-rotate(${tailHue}deg)` }} className="h-full w-auto">
                            {renderPartImg(0, 'tail', "h-full w-auto object-contain block")}
                        </div>
                        {level >= 1 && <div className="absolute inset-0 h-full w-auto">{renderPartImg(1, 'tail', "h-full w-auto object-contain block")}</div>}
                    </div>

                    {/* 2. BODY */}
                    <div className={`relative h-full w-auto flex-shrink-0 z-10 -ml-1 ${DEBUG_MODE ? 'border border-blue-500' : ''}`}>
                        <div style={{ filter: `hue-rotate(${bodyHue}deg)` }} className="h-full w-auto">
                            {renderPartImg(0, 'body', "h-full w-auto object-contain block scale-[1.02]")}
                        </div>
                        {level >= 1 && <div className="absolute inset-0 h-full w-auto">{renderPartImg(1, 'body', "h-full w-auto object-contain")}</div>}
                    </div>

                    {/* 3. HEAD */}
                    <div className={`relative h-full w-auto flex-shrink-0 z-20 -ml-1 ${DEBUG_MODE ? 'border border-green-500' : ''}`}>
                        <div style={{ filter: `hue-rotate(${headHue}deg)` }} className="h-full w-auto">
                            {renderPartImg(0, 'head', "h-full w-auto object-contain block")}
                        </div>
                        {level >= 1 && <div className="absolute inset-0 h-full w-auto">{renderPartImg(1, 'head', "h-full w-auto object-contain")}</div>}

                        {/* --- TUSK CONTAINER --- */}
                        <div
                            className={`absolute z-30 pointer-events-none ${DEBUG_MODE ? 'border-2 border-yellow-500 bg-yellow-500/20' : ''}`}
                            style={{
                                top: TUSK_TOP,
                                left: TUSK_LEFT,
                                height: TUSK_SIZE,
                                width: '100%', // Keeps aspect ratio intact
                                transform: 'translateY(-50%)' // Centers it vertically based on TUSK_TOP
                            }}
                        >
                            <div style={{ filter: `hue-rotate(${tuskHue}deg)` }} className="h-full w-full">
                                {renderPartImg(0, 'tusk', "h-full w-full object-contain object-left")}
                            </div>
                            {level >= 1 && <div className="absolute inset-0 h-full w-full">{renderPartImg(1, 'tusk', "h-full w-full object-contain object-left")}</div>}
                        </div>
                    </div>

                </div>
            </div>

            <div className="mt-2 bg-black/80 border border-narwhal-cyan px-3 py-1 text-[10px] font-mono text-narwhal-cyan tracking-widest">
                {LEVEL_NAMES[level] || "UNKNOWN"} #{dna.join('')}
            </div>
        </div>
    );
}