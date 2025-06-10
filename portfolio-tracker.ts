import { createPublicClient, http, formatEther, formatUnits, Address, PublicClient } from "viem";
import { mainnet } from "viem/chains";

// Types and Interfaces
interface TokenConfig {
  address: Address | null;
  decimals: number;
  symbol: string;
}

interface TokenBalance {
  balance: string;
  symbol: string;
  decimals: number;
}

interface WalletConfig {
  address: Address;
  label: string;
}

interface WalletBalances {
  [symbol: string]: TokenBalance;
}

interface WalletDetails {
  address: Address;
  label: string;
  balances: WalletBalances;
}

interface AggregatedBalances {
  [symbol: string]: TokenBalance;
}

interface PortfolioData {
  aggregatedBalances: AggregatedBalances;
  walletDetails: WalletDetails[];
}

interface AssetValue {
  symbol: string;
  balance: string;
  price: string;
  value: string;
  percentage: string;
}

interface PortfolioValue {
  totalValue: number;
  valueBreakdown: AssetValue[];
}

interface PriceCache {
  [symbol: string]: number;
}

interface TrackerConfig {
  rpcUrl: string;
  customTokens?: { [symbol: string]: TokenConfig };
}

// Token configurations
const DEFAULT_TOKENS: { [symbol: string]: TokenConfig } = {
  ETH: { address: null, decimals: 18, symbol: "ETH" },
  USDC: { address: "0xA0b86a33E6441c8EBb6E6c8c8c9c5C8C8c8c8c8c", decimals: 6, symbol: "USDC" },
  USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, symbol: "USDT" },
  WETH: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18, symbol: "WETH" },
  UNI: { address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18, symbol: "UNI" },
  LINK: { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18, symbol: "LINK" },
  AAVE: { address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", decimals: 18, symbol: "AAVE" },
  COMP: { address: "0xc00e94Cb662C3520282E6f5717214004A7f26888", decimals: 18, symbol: "COMP" }
};

// ERC-20 ABI
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }]
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  }
] as const;

class PortfolioTracker {
  private client: PublicClient;
  private wallets: WalletConfig[] = [];
  private portfolioData: PortfolioData = { aggregatedBalances: {}, walletDetails: [] };
  private priceCache: PriceCache = {};
  private tokens: { [symbol: string]: TokenConfig };

  constructor(config: TrackerConfig) {
    this.client = createPublicClient({
      chain: mainnet,
      transport: http(config.rpcUrl)
    });
    
    // Merge default tokens with custom tokens
    this.tokens = { ...DEFAULT_TOKENS, ...(config.customTokens || {}) };
  }

  /**
   * Add a wallet to track
   */
  addWallet(address: Address, label: string = ""): void {
    this.wallets.push({ address: address.toLowerCase() as Address, label });
  }

  /**
   * Get token price from CoinGecko
   */
  private async getTokenPrice(tokenSymbol: string): Promise<number> {
    if (this.priceCache[tokenSymbol]) {
      return this.priceCache[tokenSymbol];
    }

    try {
      const coingeckoId = this.getCoingeckoId(tokenSymbol);
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const price = data[coingeckoId]?.usd || 0;
      this.priceCache[tokenSymbol] = price;
      return price;
    } catch (error) {
      console.warn(`Failed to fetch price for ${tokenSymbol}:`, error);
      return 0;
    }
  }

  private getCoingeckoId(symbol: string): string {
    const mapping: { [key: string]: string } = {
      ETH: "ethereum",
      USDC: "usd-coin",
      USDT: "tether",
      WETH: "weth",
      UNI: "uniswap",
      LINK: "chainlink",
      AAVE: "aave",
      COMP: "compound-governance-token"
    };
    return mapping[symbol] || symbol.toLowerCase();
  }

  private async getETHBalance(address: Address): Promise<string> {
    try {
      const balance = await this.client.getBalance({ address });
      return formatEther(balance);
    } catch (error) {
      console.warn(`Failed to get ETH balance for ${address}:`, error);
      return "0";
    }
  }

  private async getTokenBalance(tokenAddress: Address, walletAddress: Address): Promise<bigint> {
    try {
      const balance = await this.client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [walletAddress]
      });
      return balance;
    } catch (error) {
      console.warn(`Failed to get token balance for ${tokenAddress}:`, error);
      return BigInt(0);
    }
  }

  private async getWalletBalances(walletAddress: Address): Promise<WalletBalances> {
    const balances: WalletBalances = {};
    
    // Get ETH balance
    const ethBalance = await this.getETHBalance(walletAddress);
    if (parseFloat(ethBalance) > 0) {
      balances.ETH = {
        balance: ethBalance,
        symbol: "ETH",
        decimals: 18
      };
    }

    // Get token balances
    for (const [symbol, token] of Object.entries(this.tokens)) {
      if (token.address) {
        const balance = await this.getTokenBalance(token.address, walletAddress);
        if (balance > 0n) {
          const formattedBalance = formatUnits(balance, token.decimals);
          if (parseFloat(formattedBalance) > 0.001) {
            balances[symbol] = {
              balance: formattedBalance,
              symbol: token.symbol,
              decimals: token.decimals
            };
          }
        }
      }
    }

    return balances;
  }

  async aggregatePortfolio(): Promise<PortfolioData> {
    console.log("Scanning wallets for token balances...\n");
    
    const aggregatedBalances: AggregatedBalances = {};
    const walletDetails: WalletDetails[] = [];

    for (const wallet of this.wallets) {
      console.log(`📍 Scanning ${wallet.label || wallet.address}...`);
      const balances = await this.getWalletBalances(wallet.address);
      
      walletDetails.push({
        address: wallet.address,
        label: wallet.label,
        balances
      });

      // Aggregate balances
      for (const [symbol, data] of Object.entries(balances)) {
        if (!aggregatedBalances[symbol]) {
          aggregatedBalances[symbol] = {
            balance: "0",
            symbol: data.symbol,
            decimals: data.decimals
          };
        }
        aggregatedBalances[symbol].balance = (
          parseFloat(aggregatedBalances[symbol].balance) + parseFloat(data.balance)
        ).toString();
      }
    }

    this.portfolioData = { aggregatedBalances, walletDetails };
    return this.portfolioData;
  }

  async calculatePortfolioValue(): Promise<PortfolioValue> {
    if (!Object.keys(this.portfolioData.aggregatedBalances).length) {
      await this.aggregatePortfolio();
    }

    console.log("\nCalculating portfolio value...\n");
    
    let totalValue = 0;
    const valueBreakdown: AssetValue[] = [];

    for (const [symbol, data] of Object.entries(this.portfolioData.aggregatedBalances)) {
      const price = await this.getTokenPrice(symbol);
      const balance = parseFloat(data.balance);
      const value = balance * price;
      
      totalValue += value;
      valueBreakdown.push({
        symbol,
        balance: balance.toFixed(6),
        price: price.toFixed(2),
        value: value.toFixed(2),
        percentage: "0"
      });
    }

    // Calculate percentages
    valueBreakdown.forEach(item => {
      item.percentage = ((parseFloat(item.value) / totalValue) * 100).toFixed(2);
    });

    // Sort by value
    valueBreakdown.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));

    return { totalValue, valueBreakdown };
  }

  async displayPortfolio(): Promise<void> {
    const { totalValue, valueBreakdown } = await this.calculatePortfolioValue();

    console.log("=".repeat(80));
    console.log("MULTI-WALLET PORTFOLIO SUMMARY");
    console.log("=".repeat(80));
    console.log(`Total Portfolio Value: $${totalValue.toFixed(2)}\n`);

    console.log("Asset Breakdown:");
    console.log("-".repeat(80));
    console.log(this.sprintf("%-8s %-15s %-12s %-15s %-10s", "Symbol", "Balance", "Price", "Value", "% Portfolio"));
    console.log("-".repeat(80));

    valueBreakdown.forEach(item => {
      console.log(this.sprintf("%-8s %-15s $%-11s $%-14s %-10s%%", 
        item.symbol, 
        item.balance, 
        item.price, 
        item.value, 
        item.percentage
      ));
    });

    console.log("\nWallet Breakdown:");
    console.log("-".repeat(80));
    this.portfolioData.walletDetails.forEach((wallet, index) => {
      console.log(`\n${index + 1}. ${wallet.label || "Wallet"} (${wallet.address})`);
      
      if (Object.keys(wallet.balances).length === 0) {
        console.log("   No significant balances found");
      } else {
        Object.entries(wallet.balances).forEach(([symbol, data]) => {
          console.log(`   ${symbol}: ${parseFloat(data.balance).toFixed(6)}`);
        });
      }
    });
  }

  private sprintf(format: string, ...args: (string | number)[]): string {
    let i = 0;
    return format.replace(/%-?(\d+)s/g, (match, width) => {
      if (i >= args.length) return match;
      const str = String(args[i++]);
      const w = parseInt(width);
      return w > 0 ? str.padEnd(w) : str.padStart(-w);
    });
  }
}

// Usage example
async function main(): Promise<void> {
  const config: TrackerConfig = {
    rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY"
  };

  const tracker = new PortfolioTracker(config);
  
  tracker.addWallet("0x742d35Cc6634C0532925a3b8D3Ac28E4FbC7C6e6" as Address, "Main Wallet");
  tracker.addWallet("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address, "DeFi Wallet");
  
  try {
    await tracker.displayPortfolio();
  } catch (error) {
    console.error("Error tracking portfolio:", error);
  }
}

export { PortfolioTracker, type TokenConfig, type TrackerConfig }; 