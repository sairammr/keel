// SPDX-License-Identifier: MIT
// VERBATIM copy of the official challenge vETH token.
// Source: https://eth-sepolia.blockscout.com/address/0x5dED1a40c3D56dA42E7f932f781c0432556c9814?tab=contract
// Address: 0x5dED1a40c3D56dA42E7f932f781c0432556c9814 (Sepolia)
// Compiler: v0.8.36+commit.8a079791 · optimizer OFF · evm cancun
// Only this provenance header was added; code below is unmodified.
pragma solidity 0.8.36;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract TokenvETH is ERC20, ERC20Burnable, AccessControl {
	bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

	constructor() ERC20("virtual ETH", "vETH") {
    	_grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    	_grantRole(ADMIN_ROLE, msg.sender);
	}

	function mint(address to, uint256 amount) public onlyRole(ADMIN_ROLE) {
    	_mint(to, amount);
	}

    function burn(uint256 value) public override onlyRole(ADMIN_ROLE) {
        _burn(_msgSender(), value);
    }

    function burnFrom(address account, uint256 value) public override onlyRole(ADMIN_ROLE) {
        _spendAllowance(account, _msgSender(), value);
        _burn(account, value);
    }

	function decimals() public pure override returns (uint8) {
    	return 2;
	}
}
