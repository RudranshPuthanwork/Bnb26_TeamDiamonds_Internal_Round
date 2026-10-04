export const heirloomRegistryAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "timeUnit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "ACTION_TYPEHASH",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_GUARDIANS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "SHARE_LEN",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "TIME_UNIT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "addAsset",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "policy",
        "type": "tuple",
        "internalType": "struct HeirloomRegistry.AssetPolicy",
        "components": [
          {
            "name": "reasonsMask",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "kAttest",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "requireEvidence",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "minInactivity",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "window",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "claimDeadline",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "primaryBenef",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "contingentBenef",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "bundleCid",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "version",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "shareCommitments",
            "type": "bytes32[]",
            "internalType": "bytes32[]"
          }
        ]
      },
      {
        "name": "auth",
        "type": "tuple",
        "internalType": "struct HeirloomRegistry.Auth",
        "components": [
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum HeirloomRegistry.AuthKind"
          },
          {
            "name": "signer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "sig",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "applyChange",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct HeirloomRegistry.Auth",
        "components": [
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum HeirloomRegistry.AuthKind"
          },
          {
            "name": "signer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "sig",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "attest",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "reason",
        "type": "uint8",
        "internalType": "enum Reason"
      },
      {
        "name": "evidenceHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "auth",
        "type": "tuple",
        "internalType": "struct HeirloomRegistry.Auth",
        "components": [
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum HeirloomRegistry.AuthKind"
          },
          {
            "name": "signer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "sig",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cancel",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "auth",
        "type": "tuple",
        "internalType": "struct HeirloomRegistry.Auth",
        "components": [
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum HeirloomRegistry.AuthKind"
          },
          {
            "name": "signer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "sig",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "claimContingent",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct HeirloomRegistry.Auth",
        "components": [
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum HeirloomRegistry.AuthKind"
          },
          {
            "name": "signer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "sig",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "createVault",
    "inputs": [
      {
        "name": "owners",
        "type": "bytes32[2]",
        "internalType": "bytes32[2]"
      },
      {
        "name": "guardians",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      },
      {
        "name": "t",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "policyDelay",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "auth",
        "type": "tuple",
        "internalType": "struct HeirloomRegistry.Auth",
        "components": [
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum HeirloomRegistry.AuthKind"
          },
          {
            "name": "signer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "sig",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "currentClaimant",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "dispute",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "auth",
        "type": "tuple",
        "internalType": "struct HeirloomRegistry.Auth",
        "components": [
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum HeirloomRegistry.AuthKind"
          },
          {
            "name": "signer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "sig",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "drill",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct HeirloomRegistry.Auth",
        "components": [
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum HeirloomRegistry.AuthKind"
          },
          {
            "name": "signer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "sig",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "eip712Domain",
    "inputs": [],
    "outputs": [
      {
        "name": "fields",
        "type": "bytes1",
        "internalType": "bytes1"
      },
      {
        "name": "name",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "version",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "chainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "verifyingContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "salt",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "extensions",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "heartbeat",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "auth",
        "type": "tuple",
        "internalType": "struct HeirloomRegistry.Auth",
        "components": [
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum HeirloomRegistry.AuthKind"
          },
          {
            "name": "signer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "sig",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isReleasable",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "keyId",
    "inputs": [
      {
        "name": "kind",
        "type": "uint8",
        "internalType": "enum HeirloomRegistry.KeyKind"
      },
      {
        "name": "a",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "b",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "markClaimed",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "auth",
        "type": "tuple",
        "internalType": "struct HeirloomRegistry.Auth",
        "components": [
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum HeirloomRegistry.AuthKind"
          },
          {
            "name": "signer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "sig",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "nonces",
    "inputs": [
      {
        "name": "keyId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "queueChange",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct HeirloomRegistry.Auth",
        "components": [
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum HeirloomRegistry.AuthKind"
          },
          {
            "name": "signer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "sig",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "rekey",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      },
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct HeirloomRegistry.Auth",
        "components": [
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum HeirloomRegistry.AuthKind"
          },
          {
            "name": "signer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "sig",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "revokeChange",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct HeirloomRegistry.Auth",
        "components": [
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum HeirloomRegistry.AuthKind"
          },
          {
            "name": "signer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "sig",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "setAbsence",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "until",
        "type": "uint40",
        "internalType": "uint40"
      },
      {
        "name": "auth",
        "type": "tuple",
        "internalType": "struct HeirloomRegistry.Auth",
        "components": [
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum HeirloomRegistry.AuthKind"
          },
          {
            "name": "signer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "sig",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "status",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "enum HeirloomRegistry.Status"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "submitShare",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "claimantKeyId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "encShare",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "auth",
        "type": "tuple",
        "internalType": "struct HeirloomRegistry.Auth",
        "components": [
          {
            "name": "kind",
            "type": "uint8",
            "internalType": "enum HeirloomRegistry.AuthKind"
          },
          {
            "name": "signer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "sig",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "timeline",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "tSilence",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "tQuorum",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "resumeAt",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "tOpen",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "opensAt",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "attestationsFiled",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "kAttest",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "disputed",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "claimDeadline",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "vaultCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "AbsenceSet",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "until",
        "type": "uint40",
        "indexed": false,
        "internalType": "uint40"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AssetAdded",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "assetId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "primaryBenef",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "bundleCid",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Attested",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "guardian",
        "type": "uint8",
        "indexed": true,
        "internalType": "uint8"
      },
      {
        "name": "reason",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum Reason"
      },
      {
        "name": "evidenceHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Cancelled",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "epoch",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ChangeApplied",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "changeId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ChangeQueued",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "changeId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "applyAfter",
        "type": "uint40",
        "indexed": false,
        "internalType": "uint40"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ChangeRevoked",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "changeId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Claimed",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "assetId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "claimant",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DisputeOverridden",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "resumeAt",
        "type": "uint40",
        "indexed": false,
        "internalType": "uint40"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Disputed",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "guardian",
        "type": "uint8",
        "indexed": true,
        "internalType": "uint8"
      },
      {
        "name": "epoch",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DrillPassed",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "guardian",
        "type": "uint8",
        "indexed": true,
        "internalType": "uint8"
      },
      {
        "name": "version",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EIP712DomainChanged",
    "inputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Heartbeat",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "epoch",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Rekeyed",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "assetId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "version",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ShareSubmitted",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "assetId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "guardian",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "VaultCreated",
    "inputs": [
      {
        "name": "vaultId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "owner0",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "owner1",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "guardians",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "t",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyClaimed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AlreadyDisputed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AssetExists",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AttestationLocked",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadAuth",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadBounds",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadNonce",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadPolicy",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadReason",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadShare",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BeneficiaryIsGuardian",
    "inputs": []
  },
  {
    "type": "error",
    "name": "DuplicateGuardian",
    "inputs": []
  },
  {
    "type": "error",
    "name": "Expired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidShortString",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoAsset",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoShares",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoVault",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotAuthorized",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotClaimant",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotImplemented",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotReleasable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ShareExists",
    "inputs": []
  },
  {
    "type": "error",
    "name": "StringTooLong",
    "inputs": [
      {
        "name": "str",
        "type": "string",
        "internalType": "string"
      }
    ]
  }
] as const;
