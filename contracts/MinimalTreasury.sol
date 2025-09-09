// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MinimalTreasury
/// @notice Minimal treasury controlled by a circle's Timelock (owner)
contract MinimalTreasury is Ownable {
    constructor(address initialOwner) Ownable(initialOwner) {}

    receive() external payable {}

    function transferETH(address payable to, uint256 amount) external onlyOwner {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "ETH_TRANSFER_FAILED");
    }

    function transferERC20(address token, address to, uint256 amount) external onlyOwner {
        require(IERC20(token).transfer(to, amount), "ERC20_TRANSFER_FAILED");
    }

    function approveERC20(address token, address spender, uint256 amount) external onlyOwner {
        require(IERC20(token).approve(spender, amount), "ERC20_APPROVE_FAILED");
    }
}

