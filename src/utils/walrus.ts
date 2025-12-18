export const WALRUS_PUBLISHERS = [
    'https://walrus-testnet-publisher.nodes.guru/v1/blobs',
    'https://walrus-testnet-publisher.stakely.io/v1/blobs',
    'https://publisher.walrus-testnet.walrus.space/v1/blobs',
    'https://walrus-testnet-publisher.everstake.one/v1/blobs',
    'https://walrus-testnet-publisher.chainbase.online/v1/blobs',
    'https://publisher.testnet.walrus.atalma.io/v1/blobs',
    'https://walrus-testnet-publisher.natsai.xyz/v1/blobs',
    'https://walrus-testnet-publisher.nodeinfra.com/v1/blobs',
];

export const WALRUS_AGGREGATORS = [
    'https://aggregator.walrus-testnet.walrus.space/v1/blobs',
    'https://aggregator.testnet.walrus.atalma.io/v1/blobs',
    'https://walrus-testnet-aggregator.nodes.guru/v1/blobs',
    'https://walrus-testnet-aggregator.stakely.io/v1/blobs',
    'https://walrus-testnet-aggregator.everstake.one/v1/blobs',
    'https://walrus-testnet-aggregator.chainbase.online/v1/blobs',
    'https://walrus-testnet-aggregator.natsai.xyz/v1/blobs',
    'https://walrus-testnet-aggregator.nodeinfra.com/v1/blobs',
];

/**
 * Uploads a file to Walrus using a list of publishers with fallback.
 * Sets epochs to 30 as requested.
 */
export async function uploadToWalrus(file: File | Blob): Promise<string> {
    let lastError: any;

    for (const publisherBaseUrl of WALRUS_PUBLISHERS) {
        try {
            // Ensure no double slashes if the url ends with /
            const baseUrl = publisherBaseUrl.endsWith('/') ? publisherBaseUrl.slice(0, -1) : publisherBaseUrl;
            // The list provided already includes /v1/blobs, but the endpoint construction in snippet was:
            // `https://publisher.../v1/blobs?epochs=5`
            // If the list items ALREADY contain /v1/blobs, we just append query params.
            // Let's verify the list format in the request.
            // List: 'https://walrus-testnet-publisher.nodes.guru/v1/blobs'

            const endpoint = `${baseUrl}?epochs=30`;

            console.log(`Attempting upload to: ${endpoint}`);

            const res = await fetch(endpoint, {
                method: "PUT",
                body: file,
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Upload failed: ${res.status} ${res.statusText} - ${errorText}`);
            }

            const text = await res.text();
            console.log("Walrus response:", text);

            let data;
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error("Invalid JSON returned from Walrus");
            }

            // Correct path based on user snippet
            const blobId =
                data?.newlyCreated?.blobObject?.blobId ||
                data?.blobObject?.blobId ||
                data?.blobId;

            if (!blobId) {
                throw new Error("blobId missing in Walrus response");
            }

            return blobId;

        } catch (error) {
            console.warn(`Failed to upload to ${publisherBaseUrl}:`, error);
            lastError = error;
            // Continue to next publisher
        }
    }

    throw new Error(`All Walrus publishers failed. Last error: ${lastError}`);
}

/**
 * Returns a URL for a blob ID using the primary aggregator or a random one.
 * Currently uses the first one but can be expanded to rotate.
 */
export function getWalrusUrl(blobId: string): string {
    // For retrieval, we can just use the first one or pick random to distribute load
    // The user snippet used: `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`
    // which corresponds to one of the aggregators.

    // Let's us the first one as default, or we could verify liveness.
    // For simplicity and strict adherence to returning a string immediately:
    const aggregator = WALRUS_AGGREGATORS[0];
    return `${aggregator}/${blobId}`;
}
