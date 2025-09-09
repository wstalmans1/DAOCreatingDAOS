// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/// @title GovernanceToken
/// @notice Simple ERC20Votes token for use with Governor-based circles.
contract GovernanceToken is ERC20, ERC20Permit, ERC20Votes {
    constructor(string memory name_, string memory symbol_, address to, uint256 initialSupply)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
    {
        _mint(to, initialSupply);
    }

    // The function below is required by Solidity to reconcile multiple inheritance.
    function _update(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._update(from, to, amount);
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
