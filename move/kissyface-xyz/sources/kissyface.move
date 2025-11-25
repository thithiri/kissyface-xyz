// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

module app::kissyface;

use enclave::enclave::{Self, Enclave};
use std::string::String;

/// ====
/// Core onchain app logic, replace it with your own.
/// ====
///

const KISSYFACE_INTENT: u8 = 0;
const EInvalidSignature: u64 = 1;

public struct KissyfaceNFT has key, store {
    id: UID,
    image: String,
    prompt: String,
    seed: u64,
    timestamp_ms: u64,
}

/// Should match the inner struct T used for IntentMessage<T> in Rust.
public struct KissyfaceResponse has copy, drop {
    image: String,
    prompt: String,
    seed: u64,
}

public struct KISSYFACE has drop {}

fun init(otw: KISSYFACE, ctx: &mut TxContext) {
    let cap = enclave::new_cap(otw, ctx);

    cap.create_enclave_config(
        b"kissyface enclave".to_string(),
        x"000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", // pcr0
        x"000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", // pcr1
        x"000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", // pcr2
        ctx,
    );

    transfer::public_transfer(cap, ctx.sender())
}

public fun update_kissyface<T>(
    image: String,
    prompt: String,
    seed: u64,
    timestamp_ms: u64,
    sig: &vector<u8>,
    enclave: &Enclave<T>,
    ctx: &mut TxContext,
): KissyfaceNFT {
    let res = enclave.verify_signature(
        KISSYFACE_INTENT,
        timestamp_ms,
        KissyfaceResponse { image, prompt, seed },
        sig,
    );
    assert!(res, EInvalidSignature);
    // Mint NFT, replace it with your own logic.
    KissyfaceNFT {
        id: object::new(ctx),
        image,
        prompt,
        seed,
        timestamp_ms,
    }
}
