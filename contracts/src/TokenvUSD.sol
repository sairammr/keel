// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MintableToken2Dec} from "./TokenvETH.sol";

contract TokenvUSD is MintableToken2Dec {
    constructor(address minter_) MintableToken2Dec("Voucher USD", "vUSD", minter_) {}
}
