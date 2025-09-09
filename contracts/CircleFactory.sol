// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {CircleGovernor} from "./CircleGovernor.sol";
import {MinimalTreasury} from "./MinimalTreasury.sol";
import {CircleRegistry} from "./CircleRegistry.sol";

/// @title CircleFactory
/// @notice Deploys circle instances (Timelock + Governor + Treasury) and registers them.
contract CircleFactory {
    CircleRegistry public immutable registry;

    error RootAlreadyExists();
    error UnauthorizedCreator(uint256 parentId, address caller);

    struct CreateParams {
        uint256 parentId; // 0 for root
        string name;
        address token; // IVotes token used by the governor
        uint48 votingDelay; // in blocks
        uint32 votingPeriod; // in blocks
        uint256 proposalThreshold; // in number of votes
        uint256 quorumNumerator; // e.g., 4 for 4%
        uint48 timelockDelay; // in seconds
    }

    constructor(CircleRegistry _registry) {
        registry = _registry;
    }

    function _deployTimelock(uint48 delay) internal returns (TimelockController tl) {
        address[] memory proposers = new address[](0);
        address[] memory executors = new address[](1);
        executors[0] = address(0); // open execution
        // Make factory temporary admin to set roles, then revoke
        tl = new TimelockController(delay, proposers, executors, address(this));
    }

    function createCircle(CreateParams memory p)
        external
        returns (uint256 id, address governor, address timelock, address treasury)
    {
        if (p.parentId == 0) {
            // root creation allowed only if no circles exist
            if (registry.totalCircles() != 0) revert RootAlreadyExists();
        } else {
            // only parent timelock can create
            if (msg.sender != registry.controllerOf(p.parentId)) {
                revert UnauthorizedCreator(p.parentId, msg.sender);
            }
        }

        TimelockController tl = _deployTimelock(p.timelockDelay);

        CircleGovernor gov = new CircleGovernor(
            p.name,
            IVotes(p.token),
            tl,
            p.votingDelay,
            p.votingPeriod,
            p.proposalThreshold,
            p.quorumNumerator
        );

        // Grant governor roles on timelock; allow parent oversight on child
        tl.grantRole(tl.PROPOSER_ROLE(), address(gov));
        tl.grantRole(tl.CANCELLER_ROLE(), address(gov));

        if (p.parentId != 0) {
            address parentTl = registry.controllerOf(p.parentId);
            // grant admin to parent for meta-governance
            tl.grantRole(tl.DEFAULT_ADMIN_ROLE(), parentTl);
        }

        // Revoke factory admin now that setup is complete
        tl.revokeRole(tl.DEFAULT_ADMIN_ROLE(), address(this));

        // Minimal treasury owned by timelock
        MinimalTreasury tre = new MinimalTreasury(address(tl));

        id = registry.register(p.parentId, address(gov), address(tl), address(tre), p.token, p.name);
        governor = address(gov);
        timelock = address(tl);
        treasury = address(tre);
    }
}
