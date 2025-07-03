import { createPublicClient, http, type Address } from "viem";
import { mainnet } from "viem/chains";

// Types
interface NFTSnapshot {
  [address: string]: number;
}

interface SnapshotConfig {
  contractAddress: string;
  rpcUrl: string;
  startTokenId?: number;
  endTokenId?: number;
}

// These are examples - actual configuration happens in the SnapshotTool constructor
// const client = createPublicClient({
//   chain: mainnet,
//   transport: http("https://api.mainnet.abs.xyz")
// });

// const contractAddress: string = "0x67266b806a2987ef6dfaf6355ccd62c29978dbf9";

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
  private client: ReturnType<typeof createPublicClient>;
  private contractAddress: string;

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
        address: this.contractAddress as Address,
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
  async getTokenOwner(tokenId: bigint): Promise<string | null> {
    try {
      const owner = await this.client.readContract({
        address: this.contractAddress as Address,
        abi: ERC721_ABI,
        functionName: "ownerOf",
        args: [tokenId]
      });
      return owner as string;
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
    
    const holders: { [address: string]: number } = {};
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
        holders[owner as string] = (holders[owner as string] || 0) + 1;
      } else {
        console.log(`Token ${i} may not exist or is burned`);
      }
    }

    return holders;
  }

  /**
   * Display snapshot results in a formatted way
   */
  displaySnapshot(snapshot: { [address: string]: number }): void {
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
  async exportToJSON(snapshot: { [address: string]: number }, filename?: string): Promise<string> {
    const exportData = {
      timestamp: new Date().toISOString(),
      contractAddress: this.contractAddress,
      totalHolders: Object.keys(snapshot).length,
      totalTokens: Object.values(snapshot).reduce((sum, count) => sum + count, 0),
      holders: snapshot
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    
    if (filename) {
      try {
        // Write to file using Node.js fs module
        const fs = await import('fs/promises');
        await fs.writeFile(filename, jsonString, 'utf8');
        console.log(`\n💾 Snapshot exported to ${filename}`);
      } catch (error) {
        console.error(`Failed to write file ${filename}:`, error);
        console.log(`\n📋 JSON data:\n${jsonString}`);
      }
    }

    return jsonString;
  }

  /**
   * Export snapshot to CSV
   */
  async exportToCSV(snapshot: { [address: string]: number }, filename?: string): Promise<string> {
    const headers = "Address,Token Count\n";
    const rows = Object.entries(snapshot)
      .sort(([, a], [, b]) => b - a) // Sort by token count descending
      .map(([address, count]) => `${address},${count}`)
      .join('\n');
    
    const csvString = headers + rows;
    
    if (filename) {
      try {
        const fs = await import('fs/promises');
        await fs.writeFile(filename, csvString, 'utf8');
        console.log(`\n📊 CSV exported to ${filename}`);
      } catch (error) {
        console.error(`Failed to write CSV file ${filename}:`, error);
        console.log(`\n📋 CSV data:\n${csvString}`);
      }
    }

    return csvString;
  }

  /**
   * Get holders eligible for airdrop (with minimum token requirement)
   */
  getAirdropEligible(snapshot: { [address: string]: number }, minTokens: number = 1): string[] {
    return Object.entries(snapshot)
      .filter(([, count]) => count >= minTokens)
      .map(([address]) => address as string);
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
    await snapshotTool.exportToJSON(snapshot, "nft-snapshot.json");
    
    // Export to CSV
    await snapshotTool.exportToCSV(snapshot, "nft-snapshot.csv");
    
    // Get airdrop eligible addresses (holders with 3+ tokens)
    const airdropEligible = snapshotTool.getAirdropEligible(snapshot, 3);
    console.log(`\nAddresses eligible for airdrop (3+ tokens): ${airdropEligible.length}`);
    
  } catch (error) {
    console.error("Error creating snapshot:", error);
  }
}

main();

export { NFTSnapshotTool, type NFTSnapshot, type SnapshotConfig }; 