import {Provider,Contract,validateAndParseAddress} from 'starknet'
// import {isDevelopEnv} from "./src/util";

async function updateLatestBlockNumber() {
    const provider = new Provider({
            sequencer: {network: 'mainnet-alpha'}
        }
    )
    // console.log(provider);return;
    const {block_number} = await provider.getBlock('latest')
    console.log(block_number)

    const address = validateAndParseAddress("0x060cf64cf9edfc1b16ec903cee31a2c21680ee02fc778225dacee578c303806a");
    console.log(address);
    const abi = [
        {
            "members": [
                {
                    "name": "low",
                    "offset": 0,
                    "type": "felt"
                },
                {
                    "name": "high",
                    "offset": 1,
                    "type": "felt"
                }
            ],
            "name": "Uint256",
            "size": 2,
            "type": "struct"
        },
        {
            "data": [
                {
                    "name": "from_",
                    "type": "felt"
                },
                {
                    "name": "to",
                    "type": "felt"
                },
                {
                    "name": "value",
                    "type": "Uint256"
                }
            ],
            "keys": [],
            "name": "Transfer",
            "type": "event"
        },
        {
            "data": [
                {
                    "name": "owner",
                    "type": "felt"
                },
                {
                    "name": "spender",
                    "type": "felt"
                },
                {
                    "name": "value",
                    "type": "Uint256"
                }
            ],
            "keys": [],
            "name": "Approval",
            "type": "event"
        },
        {
            "data": [
                {
                    "name": "previousOwner",
                    "type": "felt"
                },
                {
                    "name": "newOwner",
                    "type": "felt"
                }
            ],
            "keys": [],
            "name": "OwnershipTransferred",
            "type": "event"
        },
        {
            "inputs": [
                {
                    "name": "name",
                    "type": "felt"
                },
                {
                    "name": "symbol",
                    "type": "felt"
                }
            ],
            "name": "constructor",
            "outputs": [],
            "type": "constructor"
        },
        {
            "inputs": [],
            "name": "name",
            "outputs": [
                {
                    "name": "name",
                    "type": "felt"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "symbol",
            "outputs": [
                {
                    "name": "symbol",
                    "type": "felt"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "totalSupply",
            "outputs": [
                {
                    "name": "totalSupply",
                    "type": "Uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "decimals",
            "outputs": [
                {
                    "name": "decimals",
                    "type": "felt"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "name": "account",
                    "type": "felt"
                }
            ],
            "name": "balanceOf",
            "outputs": [
                {
                    "name": "balance",
                    "type": "Uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "name": "owner",
                    "type": "felt"
                },
                {
                    "name": "spender",
                    "type": "felt"
                }
            ],
            "name": "allowance",
            "outputs": [
                {
                    "name": "remaining",
                    "type": "Uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "name": "recipient",
                    "type": "felt"
                },
                {
                    "name": "amount",
                    "type": "Uint256"
                }
            ],
            "name": "transfer",
            "outputs": [
                {
                    "name": "success",
                    "type": "felt"
                }
            ],
            "type": "function"
        },
        {
            "inputs": [
                {
                    "name": "sender",
                    "type": "felt"
                },
                {
                    "name": "recipient",
                    "type": "felt"
                },
                {
                    "name": "amount",
                    "type": "Uint256"
                }
            ],
            "name": "transferFrom",
            "outputs": [
                {
                    "name": "success",
                    "type": "felt"
                }
            ],
            "type": "function"
        },
        {
            "inputs": [
                {
                    "name": "spender",
                    "type": "felt"
                },
                {
                    "name": "amount",
                    "type": "Uint256"
                }
            ],
            "name": "approve",
            "outputs": [
                {
                    "name": "success",
                    "type": "felt"
                }
            ],
            "type": "function"
        },
        {
            "inputs": [
                {
                    "name": "spender",
                    "type": "felt"
                },
                {
                    "name": "added_value",
                    "type": "Uint256"
                }
            ],
            "name": "increaseAllowance",
            "outputs": [
                {
                    "name": "success",
                    "type": "felt"
                }
            ],
            "type": "function"
        },
        {
            "inputs": [
                {
                    "name": "spender",
                    "type": "felt"
                },
                {
                    "name": "subtracted_value",
                    "type": "Uint256"
                }
            ],
            "name": "decreaseAllowance",
            "outputs": [
                {
                    "name": "success",
                    "type": "felt"
                }
            ],
            "type": "function"
        },
        {
            "inputs": [
                {
                    "name": "newOwner",
                    "type": "felt"
                }
            ],
            "name": "transferOwnership",
            "outputs": [],
            "type": "function"
        },
        {
            "inputs": [],
            "name": "renounceOwnership",
            "outputs": [],
            "type": "function"
        },
        {
            "inputs": [
                {
                    "name": "to",
                    "type": "felt"
                },
                {
                    "name": "amount",
                    "type": "Uint256"
                }
            ],
            "name": "mint",
            "outputs": [],
            "type": "function"
        }
    ];
    const contract = new Contract(abi, address);
    const name_result = await contract.call("name", []);
    // const name = parseBN2String(name_result[0]);
    // const symbol_result = await contract.call("symbol", []);
    // const symbol = parseBN2String(symbol_result[0]);
    // const decimals_result = await contract.call("decimals", []);
    // const decimals = toRaw(decimals_result[0]).toNumber();

    console.log("name: ", name_result);
}


updateLatestBlockNumber();