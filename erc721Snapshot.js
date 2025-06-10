const { createPublicClient, http } = require("viem");
const { mainnet } = require("viem/chains");

const client = createPublicClient({
  chain: mainnet,
  transport: http("https://api.mainnet.abs.xyz")
});

const contractAddress = "0x67266b806a2987ef6dfaf6355ccd62c29978dbf9";
const abi = [ // Basic ERC721 ABI
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
];

async function getSnapshot() {
  const holders = {};
  
  // Get total supply
  const totalSupply = await client.readContract({
    address: contractAddress,
    abi,
    functionName: "totalSupply"
  });

  for (let i = 0; i < Number(totalSupply); i++) {
    try {
      const owner = await client.readContract({
        address: contractAddress,
        abi,
        functionName: "ownerOf",
        args: [BigInt(i)]
      });
      
      holders[owner] = (holders[owner] || 0) + 1;
    } catch (e) {
      console.log(`Token ${i} may not exist`);
    }
  }

  console.log("Snapshot complete:", holders);
}

getSnapshot();