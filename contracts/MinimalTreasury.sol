// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MinimalTreasury
/// @notice Minimal treasury controlled by a circle's Timelock (owner)
contract MinimalTreasury is Ownable {
    uint256 public maxTransferAmount; // 0 means no cap

    error EthTransferLimit();
    error Erc20TransferLimit();

    constructor(address initialOwner) Ownable(initialOwner) {
        maxTransferAmount = 0; // no cap by default
    }

    receive() external payable {}

    function setMaxTransferAmount(uint256 newMax) external onlyOwner {
        maxTransferAmount = newMax;
    }

    function transferETH(address payable to, uint256 amount) external onlyOwner {
        if (maxTransferAmount != 0 && amount > maxTransferAmount) revert EthTransferLimit();
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "ETH_TRANSFER_FAILED");
    }

    function transferERC20(address token, address to, uint256 amount) external onlyOwner {
        if (maxTransferAmount != 0 && amount > maxTransferAmount) revert Erc20TransferLimit();
        require(IERC20(token).transfer(to, amount), "ERC20_TRANSFER_FAILED");
    }

    function approveERC20(address token, address spender, uint256 amount) external onlyOwner {
        require(IERC20(token).approve(spender, amount), "ERC20_APPROVE_FAILED");
    }
}
