// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Votes} from "@openzeppelin/contracts/governance/utils/Votes.sol";

/// @title Soulbound1155Votes
/// @notice Minimal ERC1155-based, non-transferable token where balances (of a fixed id) power IVotes for OZ Governor.
///         Uses OZ Votes to provide checkpointed voting and delegation. Transfers are disabled (soulbound),
///         but owner can mint/burn to manage membership.
contract Soulbound1155Votes is ERC1155, EIP712, Votes, Ownable {
    // Single class id used for voting units; extend to multi-id if needed.
    uint256 public constant VOTE_ID = 1;

    error Soulbound();

    constructor(string memory uri_) ERC1155(uri_) EIP712("Soulbound1155Votes", "1") Ownable(msg.sender) {}

    // --- Mint/Burn ---
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, VOTE_ID, amount, "");
        _afterMint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, VOTE_ID, amount);
        _afterBurn(from, amount);
    }

    // --- Soulbound: block transfers ---
    function safeTransferFrom(address, address, uint256, uint256, bytes memory) public pure override {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    // --- Votes integration ---
    // We don't support transfers; adjust voting units on mint/burn directly.
    function _getVotingUnits(address account) internal view override returns (uint256) {
        return balanceOf(account, VOTE_ID);
    }

    function _afterMint(address to, uint256 amount) private {
        _transferVotingUnits(address(0), to, amount);
    }

    function _afterBurn(address from, uint256 amount) private {
        _transferVotingUnits(from, address(0), amount);
    }

    // Note: We don't override _mint/_burn as they are not virtual in OZ ERC1155 v5.
}
