# 🔧 Ethereum Tools Collection

A collection of powerful Ethereum blockchain analysis tools built with [Viem](https://viem.sh/) for modern, TypeScript-first blockchain interactions.

## 📦 Tools Included

### 1. 🖼️ ERC-721 NFT Snapshot Tool (`erc721snapshot.js`)
Create snapshots of NFT holder distributions for airdrops, analytics, or governance.

### 2. 💰 Multi-Wallet Portfolio Tracker (`erc20portfoliotracker.js`)
Track token balances and portfolio values across multiple Ethereum addresses.

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18 or higher (for native fetch support)
- npm or yarn package manager

### Installation

1. **Clone or download the tools**
```bash
git clone <your-repo> # or download individual files
cd ethereum-tools
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up RPC endpoints**
- Get a free API key from [Alchemy](https://www.alchemy.com/), [Infura](https://infura.io/), or [QuickNode](https://www.quicknode.com/)
- Update the RPC URLs in the respective TypeScript files

---

## 🖼️ ERC-721 NFT Snapshot Tool

### Features
- ✅ Snapshot NFT holder distributions
- ✅ Count tokens per holder address
- ✅ Handle non-existent token IDs gracefully
- ✅ Perfect for airdrop planning
- ✅ Built with Viem for reliability

### Usage

1. **Configure the contract**
```typescript
// Edit erc721snapshot.ts
const contractAddress = "0x67266b806a2987ef6dfaf6355ccd62c29978dbf9"; // Your NFT contract
const client = createPublicClient({
  chain: mainnet,
  transport: http("https://your-rpc-endpoint.com")
});
```

2. **Run the snapshot**
```bash
# Direct TypeScript execution
npm run snapshot

# Or compile first then run
npm run build
npm run snapshot:js
```

### Example Output
```
Token 0 may not exist
Token 1 may not exist
...
Snapshot complete: {
  '0x742d35Cc6634C0532925a3b8D3Ac28E4FbC7C6e6': 3,
  '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045': 1,
  '0x8ba1f109551bD432803012645Hac136c22C57B9a': 7
}
```

### Use Cases
- **Airdrops**: Distribute tokens based on NFT holdings
- **Governance**: Weight voting power by NFT ownership
- **Analytics**: Understand holder distribution
- **Community Building**: Identify top collectors

---

## 💰 Multi-Wallet Portfolio Tracker

### Features
- ✅ Track multiple wallets simultaneously
- ✅ Support for ETH + major ERC-20 tokens
- ✅ Real-time price data from CoinGecko
- ✅ Portfolio aggregation and valuation
- ✅ Detailed breakdown by asset and wallet
- ✅ Clean, formatted console output
- ✅ Extensible for additional tokens

### Supported Tokens
- **ETH** - Ethereum
- **USDC** - USD Coin
- **USDT** - Tether USD
- **WETH** - Wrapped Ethereum
- **UNI** - Uniswap
- **LINK** - Chainlink
- **AAVE** - Aave Token
- **COMP** - Compound Token

### Usage

1. **Configure your setup**
```typescript
// Edit portfolio-tracker.ts
const config: TrackerConfig = {
  rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY"
};
const tracker = new PortfolioTracker(config);
```

2. **Add your wallets**
```typescript
tracker.addWallet("0x742d35Cc6634C0532925a3b8D3Ac28E4FbC7C6e6", "Main Wallet");
tracker.addWallet("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "DeFi Wallet");
tracker.addWallet("0x8ba1f109551bD432803012645Hac136c22C57B9a", "Trading Wallet");
```

3. **Run the tracker**
```bash
# Direct TypeScript execution
npm run portfolio

# Or compile first then run
npm run build
npm run portfolio:js
```

### Example Output
```
🔄 Scanning wallets for token balances...
📍 Scanning Main Wallet...
📍 Scanning DeFi Wallet...
📍 Scanning Trading Wallet...

💰 Calculating portfolio value...

================================================================================
🏦 MULTI-WALLET PORTFOLIO SUMMARY
================================================================================
📊 Total Portfolio Value: $125,432.50

📈 Asset Breakdown:
--------------------------------------------------------------------------------
Symbol   Balance         Price        Value           % Portfolio
--------------------------------------------------------------------------------
ETH      45.234567       $2,100.00    $95,032.69     75.68%
USDC     15000.000000    $1.00        $15,000.00     11.94%
LINK     1250.500000     $12.50       $15,631.25     12.45%

📱 Wallet Breakdown:
--------------------------------------------------------------------------------

1. Main Wallet (0x742d35cc6634c0532925a3b8d3ac28e4fbc7c6e6)
   ETH: 25.500000
   USDC: 10000.000000

2. DeFi Wallet (0xd8da6bf26964af9d7eed9e03e53415d37aa96045)
   ETH: 19.734567
   LINK: 1250.500000

3. Trading Wallet (0x8ba1f109551bd432803012645hac136c22c57b9a)
   USDC: 5000.000000
```

### Programmatic Usage
```typescript
import { PortfolioTracker, type TrackerConfig } from './portfolio-tracker.js';

const config: TrackerConfig = {
  rpcUrl: "https://your-rpc-endpoint.com"
};
const tracker = new PortfolioTracker(config);
tracker.addWallet("0x...", "My Wallet");

// Get raw portfolio data
const portfolioData = await tracker.aggregatePortfolio();

// Get portfolio valuation
const { totalValue, valueBreakdown } = await tracker.calculatePortfolioValue();

// Display formatted output
await tracker.displayPortfolio();
```

---

## 🔧 Configuration

### RPC Endpoints
Both tools require Ethereum RPC endpoints. Free options:

- **Alchemy**: 300M compute units/month free
- **Infura**: 100k requests/day free  
- **QuickNode**: 500M credits/month free
- **Public RPCs**: Limited rate limits

### Adding Custom Tokens (Portfolio Tracker)
```javascript
const TOKENS = {
  // Add your custom token
  YourToken: { 
    address: "0x...", 
    decimals: 18, 
    symbol: "TOKEN" 
  }
};
```

### Rate Limiting
- CoinGecko API: 10-30 calls/minute (free tier)
- RPC calls: Varies by provider
- Consider caching for frequent usage

---

## 🚀 Advanced Usage

### Batch Processing (NFT Snapshot)
```javascript
// Process multiple contracts
const contracts = [
  "0x67266b806a2987ef6dfaf6355ccd62c29978dbf9",
  "0x...",
  "0x..."
];

for (const address of contracts) {
  // Update contractAddress and run snapshot
}
```

### Export Data (Portfolio Tracker)
```javascript
// Add to PortfolioTracker class
exportToCSV() {
  const csv = this.portfolioData.walletDetails.map(wallet => 
    Object.entries(wallet.balances).map(([symbol, data]) =>
      `${wallet.label},${symbol},${data.balance}`
    ).join('\n')
  ).join('\n');
  
  console.log("Address,Token,Balance\n" + csv);
}
```

### Historical Tracking
```javascript
// Store snapshots over time
const historicalData = {
  "2024-01-01": await tracker.aggregatePortfolio(),
  "2024-02-01": await tracker.aggregatePortfolio()
};
```

## 🔗 Resources

- [Viem Documentation](https://viem.sh/)
- [Ethereum JSON-RPC API](https://ethereum.org/en/developers/docs/apis/json-rpc/)
- [CoinGecko API](https://www.coingecko.com/en/api)
- [ERC-20 Token Standard](https://eips.ethereum.org/EIPS/eip-20)
- [ERC-721 NFT Standard](https://eips.ethereum.org/EIPS/eip-721)