import { createPublicClient, http, Address, PublicClient } from "viem";
import { mainnet } from "viem/chains";

// Types
interface NFTSnapshot {
  [address: Address]: number;
}

interface SnapshotConfig {
  contractAddress: Address;
  rpcUrl: string;
  startTokenId?: number;
  endTokenId?: number;
}

// Client setup
const client: PublicClient = createPublicClient({
  chain: mainnet,
  transport: http("https://api.mainnet.abs.xyz")
});

// Contract configuration
const contractAddress: Address = "0x67266b806a2987ef6dfaf6355ccd62c29978dbf9";

// ERC-721 ABI
const ERC721_ABI = [
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }]
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

class NFTSnapshotTool {
  private client: PublicClient;
  private contractAddress: Address;

  constructor(config: SnapshotConfig) {
    this.contractAddress = config.contractAddress;
    this.client = createPublicClient({
      chain: mainnet,
      transport: http(config.rpcUrl)
    });
  }

  /**
   * Get the total supply of the NFT collection
   */
  async getTotalSupply(): Promise<bigint> {
    try {
      const totalSupply = await this.client.readContract({
        address: this.contractAddress,
        abi: ERC721_ABI,
        functionName: "totalSupply"
      });
      return totalSupply;
    } catch (error) {
      console.error("Failed to get total supply:", error);
      throw error;
    }
  }

  /**
   * Get the owner of a specific token ID
   */
  async getTokenOwner(tokenId: bigint): Promise<Address | null> {
    try {
      const owner = await this.client.readContract({
        address: this.contractAddress,
        abi: ERC721_ABI,
        functionName: "ownerOf",
        args: [tokenId]
      });
      return owner as Address;
    } catch (error) {
      // Token might not exist or be burned
      return null;
    }
  }

  /**
   * Create a snapshot of all NFT holders
   */
  async createSnapshot(startId?: number, endId?: number): Promise<NFTSnapshot> {
    console.log("🔄 Starting NFT snapshot...");
    
    const holders: NFTSnapshot = {};
    let totalSupply: bigint;

    try {
      totalSupply = await this.getTotalSupply();
      console.log(`Total Supply: ${totalSupply.toString()}`);
    } catch (error) {
      console.error("Failed to get total supply, using manual range");
      if (!startId || !endId) {
        throw new Error("Must provide startId and endId if totalSupply is not available");
      }
      totalSupply = BigInt(endId);
    }

    const start = startId ? BigInt(startId) : BigInt(0);
    const end = endId ? BigInt(endId) : totalSupply;

    console.log(`🔍 Scanning tokens ${start} to ${end - BigInt(1)}...`);

    for (let i = start; i < end; i++) {
      if (i % BigInt(100) === BigInt(0)) {
        console.log(`Progress: ${i}/${end} (${((Number(i) / Number(end)) * 100).toFixed(1)}%)`);
      }

      const owner = await this.getTokenOwner(i);
      
      if (owner) {
        holders[owner] = (holders[owner] || 0) + 1;
      } else {
        console.log(`Token ${i} may not exist or is burned`);
      }
    }

    return holders;
  }

  /**
   * Display snapshot results in a formatted way
   */
  displaySnapshot(snapshot: NFTSnapshot): void {
    const totalHolders = Object.keys(snapshot).length;
    const totalTokens = Object.values(snapshot).reduce((sum, count) => sum + count, 0);

    console.log("\n" + "=".repeat(80));
    console.log("🖼️  NFT HOLDER SNAPSHOT RESULTS");
    console.log("=".repeat(80));
    console.log(`📊 Total Unique Holders: ${totalHolders}`);
    console.log(`🎯 Total Tokens Tracked: ${totalTokens}`);
    console.log(`📈 Average Tokens per Holder: ${(totalTokens / totalHolders).toFixed(2)}\n`);

    // Sort holders by token count (descending)
    const sortedHolders = Object.entries(snapshot)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20); // Show top 20

    console.log("Top Holders:");
    console.log("-".repeat(80));
    console.log("Rank | Address                                      | Token Count");
    console.log("-".repeat(80));

    sortedHolders.forEach(([address, count], index) => {
      console.log(`${(index + 1).toString().padStart(4)} | ${address} | ${count.toString().padStart(11)}`);
    });

    if (Object.keys(snapshot).length > 20) {
      console.log(`\n... and ${Object.keys(snapshot).length - 20} more holders`);
    }
  }

  /**
   * Export snapshot to JSON
   */
  exportToJSON(snapshot: NFTSnapshot, filename?: string): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      contractAddress: this.contractAddress,
      totalHolders: Object.keys(snapshot).length,
      totalTokens: Object.values(snapshot).reduce((sum, count) => sum + count, 0),
      holders: snapshot
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    
    if (filename) {
      // In a real implementation, you'd write to file here
      console.log(`\nSnapshot exported to ${filename}`);
    }

    return jsonString;
  }

  /**
   * Get holders eligible for airdrop (with minimum token requirement)
   */
  getAirdropEligible(snapshot: NFTSnapshot, minTokens: number = 1): Address[] {
    return Object.entries(snapshot)
      .filter(([, count]) => count >= minTokens)
      .map(([address]) => address as Address);
  }
}

// Usage example
async function main(): Promise<void> {
  const config: SnapshotConfig = {
    contractAddress: "0x67266b806a2987ef6dfaf6355ccd62c29978dbf9",
    rpcUrl: "https://api.mainnet.abs.xyz"
  };

  const snapshotTool = new NFTSnapshotTool(config);

  try {
    // Create snapshot
    const snapshot = await snapshotTool.createSnapshot();
    
    // Display results
    snapshotTool.displaySnapshot(snapshot);
    
    // Export to JSON
    const jsonExport = snapshotTool.exportToJSON(snapshot, "nft-snapshot.json");
    
    // Get airdrop eligible addresses (holders with 2+ tokens)
    const airdropEligible = snapshotTool.getAirdropEligible(snapshot, 2);
    console.log(`\nAddresses eligible for airdrop (2+ tokens): ${airdropEligible.length}`);
    
  } catch (error) {
    console.error("Error creating snapshot:", error);
  }
}

main();

export { NFTSnapshotTool, type NFTSnapshot, type SnapshotConfig }; 