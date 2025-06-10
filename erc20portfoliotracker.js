const { createPublicClient, http, formatEther, formatUnits } = require("viem");
const { mainnet } = require("viem/chains");

const client = createPublicClient({
  chain: mainnet,
  transport: http("https://eth-mainnet.g.alchemy.com/v2/your-api-key") // Replace with your RPC
});

// Common token addresses and decimals
const TOKENS = {
  ETH: { address: null, decimals: 18, symbol: "ETH" },
  USDC: { address: "0xA0b86a33E6441c8EBb6E6c8c8c9c5C8C8c8c8c8c", decimals: 6, symbol: "USDC" },
  USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, symbol: "USDT" },
  WETH: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18, symbol: "WETH" },
  UNI: { address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18, symbol: "UNI" },
  LINK: { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18, symbol: "LINK" },
  AAVE: { address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", decimals: 18, symbol: "AAVE" },
  COMP: { address: "0xc00e94Cb662C3520282E6f5717214004A7f26888", decimals: 18, symbol: "COMP" }
};

// ERC-20 ABI for balance checks
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
];

class PortfolioTracker {
  constructor() {
    this.wallets = [];
    this.portfolioData = {};
    this.priceCache = {};
  }

  addWallet(address, label = "") {
    this.wallets.push({ address: address.toLowerCase(), label });
  }

  async getTokenPrice(tokenSymbol) {
    // Simple price fetching from CoinGecko (free tier)
    if (this.priceCache[tokenSymbol]) {
      return this.priceCache[tokenSymbol];
    }

    try {
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${this.getCoingeckoId(tokenSymbol)}&vs_currencies=usd`);
      const data = await response.json();
      const price = data[this.getCoingeckoId(tokenSymbol)]?.usd || 0;
      this.priceCache[tokenSymbol] = price;
      return price;
    } catch (error) {
      console.log(`Failed to fetch price for ${tokenSymbol}`);
      return 0;
    }
  }

  getCoingeckoId(symbol) {
    const mapping = {
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

  async getETHBalance(address) {
    try {
      const balance = await client.getBalance({ address });
      return formatEther(balance);
    } catch (error) {
      console.log(`Failed to get ETH balance for ${address}`);
      return "0";
    }
  }

  async getTokenBalance(tokenAddress, walletAddress) {
    try {
      const balance = await client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [walletAddress]
      });
      return balance;
    } catch (error) {
      console.log(`Failed to get token balance for ${tokenAddress}`);
      return BigInt(0);
    }
  }

  async getWalletBalances(walletAddress) {
    const balances = {};
    
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
    for (const [symbol, token] of Object.entries(TOKENS)) {
      if (token.address) {
        const balance = await this.getTokenBalance(token.address, walletAddress);
        if (balance > 0n) {
          const formattedBalance = formatUnits(balance, token.decimals);
          if (parseFloat(formattedBalance) > 0.001) { // Only show significant balances
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

  async aggregatePortfolio() {
    console.log("🔄 Scanning wallets for token balances...\n");
    
    const aggregatedBalances = {};
    const walletDetails = [];

    for (const wallet of this.wallets) {
      console.log(`📍 Scanning ${wallet.label || wallet.address}...`);
      const balances = await this.getWalletBalances(wallet.address);
      
      walletDetails.push({
        address: wallet.address,
        label: wallet.label,
        balances
      });

      // Aggregate balances across all wallets
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

  async calculatePortfolioValue() {
    if (!this.portfolioData.aggregatedBalances) {
      await this.aggregatePortfolio();
    }

    console.log("\n💰 Calculating portfolio value...\n");
    
    let totalValue = 0;
    const valueBreakdown = [];

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
        percentage: 0 // Will calculate after we have total
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

  async displayPortfolio() {
    const { totalValue, valueBreakdown } = await this.calculatePortfolioValue();

    console.log("=" * 80);
    console.log("🏦 MULTI-WALLET PORTFOLIO SUMMARY");
    console.log("=" * 80);
    console.log(`📊 Total Portfolio Value: $${totalValue.toFixed(2)}\n`);

    console.log("📈 Asset Breakdown:");
    console.log("-".repeat(80));
    console.log(sprintf("%-8s %-15s %-12s %-15s %-10s", "Symbol", "Balance", "Price", "Value", "% Portfolio"));
    console.log("-".repeat(80));

    valueBreakdown.forEach(item => {
      console.log(sprintf("%-8s %-15s $%-11s $%-14s %-10s%%", 
        item.symbol, 
        item.balance, 
        item.price, 
        item.value, 
        item.percentage
      ));
    });

    console.log("\n📱 Wallet Breakdown:");
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

  // Utility method to track P&L (requires historical data)
  trackPnL(purchaseData) {
    console.log("\n📊 P&L Tracking (requires historical purchase data):");
    console.log("To implement P&L tracking, provide purchase data in format:");
    console.log("{ symbol: 'ETH', amount: 1.5, purchasePrice: 2000, date: '2024-01-01' }");
    
    // This would calculate current value vs purchase value
    // Implementation would require storing historical purchase data
  }
}

// Helper function for string formatting
function sprintf(format, ...args) {
  return format.replace(/%[-+#0 ]*\*?(?:\d+|\*)?(?:\.(?:\d+|\*))?[hlL]?[%bcdiouxXeEfFgGaAcspn]/g, function(match, index) {
    return args[index] || '';
  });
}

// Usage Example
async function main() {
  const tracker = new PortfolioTracker();
  
  // Add your wallet addresses here
  tracker.addWallet("0x742d35Cc6634C0532925a3b8D3Ac28E4FbC7C6e6", "Main Wallet");
  tracker.addWallet("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "DeFi Wallet");
  tracker.addWallet("0x8ba1f109551bD432803012645Hac136c22C57B9a", "Trading Wallet");
  // Add more wallets as needed
  
  try {
    await tracker.displayPortfolio();
  } catch (error) {
    console.error("Error tracking portfolio:", error);
  }
}

// Uncomment to run
// main();

module.exports = PortfolioTracker; 