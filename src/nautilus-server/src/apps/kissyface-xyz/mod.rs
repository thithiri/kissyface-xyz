// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

use crate::common::IntentMessage;
use crate::common::{to_signed_response, IntentScope, ProcessDataRequest, ProcessedDataResponse};
use crate::AppState;
use crate::EnclaveError;
use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::info;
use fastcrypto::encoding::{Base64, Hex, Encoding};
use fastcrypto::traits::ToFromBytes;
use fastcrypto::ed25519::{Ed25519PublicKey, Ed25519Signature};
use fastcrypto::traits::VerifyingKey;
use fastcrypto::hash::{Blake2b256, HashFunction};

/// ====
/// Core Nautilus server logic, replace it with your own
/// relavant structs and process_data endpoint.
/// ====
/// Inner type T for IntentMessage<T>
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImageGenResponse {
    pub image: String, // base64
    pub prompt: String,
    pub seed: u32,
}

/// Inner type T for ProcessDataRequest<T>
#[derive(Debug, Serialize, Deserialize)]
pub struct ImageGenRequest {
    pub prompt: String,
    pub height: u32,
    pub width: u32,
    pub seed: u32,
    pub steps: u32,
    pub lora_path: String,
    pub lora_scale: f32,
    pub refinement_instruction: Option<String>,
    pub trigger_prefix: Option<String>,
    pub trigger_suffix: Option<String>,
    pub signature: String,
    pub date: String,
}

async fn refine_prompt(
    prompt: &str,
    refinement_instruction: Option<&str>,
    api_key: &str,
) -> Result<String, EnclaveError> {
    let instruction = match refinement_instruction {
        Some(i) => i,
        None => return Ok(prompt.to_string()),
    };

    let client = reqwest::Client::new();
    let payload = json!({
        "model": "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
        "messages": [
            {
                "role": "system",
                "content": format!("Your task is to help refine prompts that will be passed to an image generation model. {}. Only respond with the improved prompt and nothing else. Be as terse as possible, do not include quotes.", instruction)
            },
            {
                "role": "user",
                "content": format!("Write a more detailed prompt about \"{}\"", prompt)
            }
        ]
    });

    let response = client
        .post("https://api.together.xyz/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&payload)
        .send()
        .await
        .map_err(|e| EnclaveError::GenericError(format!("Failed to refine prompt: {}", e)))?;

    if !response.status().is_success() {
        info!("Prompt refinement failed, using original prompt. Status: {}", response.status());
        return Ok(prompt.to_string());
    }

    let response_json: Value = response
        .json()
        .await
        .map_err(|e| EnclaveError::GenericError(format!("Failed to parse refinement response: {}", e)))?;

    let refined = response_json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or(prompt)
        .to_string();

    Ok(refined)
}

#[derive(Serialize)]
struct SuiIntent {
    scope: u8, // 3 for PersonalMessage
    version: u8, // 0
    app_id: u8, // 0
}

#[derive(Serialize)]
struct SuiIntentMessage<T> {
    intent: SuiIntent,
    value: T,
}

async fn verify_signature(signature: &str, date: &str) -> Result<String, EnclaveError> {
    // 1. Decode the signature (Base64)
    let sig_bytes = Base64::decode(signature)
        .map_err(|e| EnclaveError::GenericError(format!("Invalid base64 signature: {}", e)))?;

    // 2. Parse signature scheme (1 byte), signature (64 bytes), public key (32 bytes)
    if sig_bytes.len() != 97 {
        return Err(EnclaveError::GenericError("Invalid signature length".to_string()));
    }

    let scheme = sig_bytes[0];
    if scheme != 0 { // 0 is Ed25519
        return Err(EnclaveError::GenericError("Unsupported signature scheme".to_string()));
    }

    let signature_bytes = &sig_bytes[1..65];
    let pubkey_bytes = &sig_bytes[65..97];

    let pubkey = Ed25519PublicKey::from_bytes(pubkey_bytes)
        .map_err(|e| EnclaveError::GenericError(format!("Invalid public key: {}", e)))?;

    let signature = Ed25519Signature::from_bytes(signature_bytes)
        .map_err(|e| EnclaveError::GenericError(format!("Invalid signature bytes: {}", e)))?;

    // 3. Construct the message and intent
    let message = format!("I support AI model creators! {}", date);
    let message_bytes = message.as_bytes().to_vec(); // Vec<u8>

    println!("Verifying signature for message: '{}'", message);
    println!("Date: '{}'", date);
    println!("Signature: {}", signature);
    println!("Message bytes (hex): {}", Hex::encode(&message_bytes));

    let intent = SuiIntent { scope: 3, version: 0, app_id: 0 };
    let intent_msg = SuiIntentMessage { intent, value: message_bytes };
    
    let intent_msg_bytes = bcs::to_bytes(&intent_msg)
        .map_err(|e| EnclaveError::GenericError(format!("Failed to serialize intent message: {}", e)))?;

    println!("Intent message bytes (hex): {}", Hex::encode(&intent_msg_bytes));

    // 4. Verify
    // Sui signatures are over the Blake2b256 hash of the intent message
    let mut digest_hasher = Blake2b256::default();
    digest_hasher.update(&intent_msg_bytes);
    let digest = digest_hasher.finalize();
    
    println!("Digest (hex): {}", Hex::encode(digest.digest));

    pubkey.verify(&digest.digest, &signature)
        .map_err(|e| EnclaveError::GenericError(format!("Signature verification failed: {}", e)))?;

    // 5. Get Address
    let mut hasher = Blake2b256::default();
    hasher.update(&[0x00]); // Ed25519 flag
    hasher.update(pubkey_bytes);
    let address_bytes = hasher.finalize();
    let address = format!("0x{}", Hex::encode(address_bytes.digest));

    Ok(address)
}

async fn get_credit(user_address: &str, frontend_url: &str) -> Result<i64, EnclaveError> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/credit?user_id={}", frontend_url, user_address);
    
    println!("Querying credit balance: {}", url);
    
    let response = client.get(&url).send().await
        .map_err(|e| EnclaveError::GenericError(format!("Failed to query credit: {}", e)))?;

    let status = response.status();
    println!("Credit API response status: {}", status);
    
    if !status.is_success() {
        let error_body = response.text().await.unwrap_or_default();
        println!("Credit API error body: {}", error_body);
        return Err(EnclaveError::GenericError(format!("Failed to get credit info: {} - {}", status, error_body)));
    }

    let json: Value = response.json().await
        .map_err(|e| EnclaveError::GenericError(format!("Failed to parse credit response: {}", e)))?;

    let kisses = json["kisses"].as_i64().unwrap_or(0);
    println!("User {} has {} kisses", user_address, kisses);
    Ok(kisses)
}

async fn upload_to_walrus(image_base64: &str) -> Result<String, EnclaveError> {
    let endpoint_key = std::env::var("WALRUS_ENDPOINT_KEY")
        .map_err(|_| EnclaveError::GenericError("WALRUS_ENDPOINT_KEY not set".to_string()))?;
    
    // Decode base64 image
    let image_bytes = Base64::decode(image_base64)
        .map_err(|e| EnclaveError::GenericError(format!("Failed to decode image: {}", e)))?;
    
    let url = format!("https://walrus-mainnet-publisher.nami.cloud/{}/v1/blobs?epochs=1", endpoint_key);
    
    println!("Uploading to Walrus for 1 epoch: {}", url);
    
    let client = reqwest::Client::new();
    let response = client
        .put(&url)
        .header("Content-Type", "image/jpeg")
        .body(image_bytes)
        .send()
        .await
        .map_err(|e| EnclaveError::GenericError(format!("Failed to upload to Walrus: {}", e)))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(EnclaveError::GenericError(format!(
            "Walrus upload failed: {} - {}",
            status,
            error_text
        )));
    }
    
    // Parse response to get blob ID
    let response_json: Value = response.json().await
        .map_err(|e| EnclaveError::GenericError(format!("Failed to parse Walrus response: {}", e)))?;
    
    // Extract blob ID from response (adjust based on actual Walrus response format)
    let blob_id = response_json["blobId"]
        .as_str()
        .or_else(|| response_json["newlyCreated"]["blobObject"]["blobId"].as_str())
        .ok_or_else(|| EnclaveError::GenericError("Failed to get blob ID from Walrus response".to_string()))?;
    
    let walrus_url = format!("https://aggregator.walrus-mainnet.walrus.space/v1/{}", blob_id);
    println!("Successfully uploaded to Walrus: {}", walrus_url);
    Ok(walrus_url)
}

pub async fn process_data(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ProcessDataRequest<ImageGenRequest>>,
) -> Result<Json<ProcessedDataResponse<IntentMessage<ImageGenResponse>>>, EnclaveError> {
    let api_key = std::env::var("API_KEY")
        .map_err(|_| EnclaveError::GenericError("API_KEY not set".to_string()))?;

    let frontend_url = std::env::var("FRONTEND_URL")
        .map_err(|_| EnclaveError::GenericError("FRONTEND_URL not set".to_string()))?;

    // 1. Verify Signature and Get Address
    let user_address = verify_signature(&request.payload.signature, &request.payload.date).await?;
    println!("Verified signature for address: {}", user_address);

    // 2. Check Credit
    let credit = get_credit(&user_address, &frontend_url).await?;
    if credit < 1 {
        return Err(EnclaveError::GenericError("Not enough credits".to_string()));
    }

    // 1. Refine Prompt
    let refined_prompt = refine_prompt(
        &request.payload.prompt,
        request.payload.refinement_instruction.as_deref(),
        &api_key,
    )
    .await?;

    // 2. Apply Triggers
    let mut final_prompt = refined_prompt;
    if let Some(prefix) = &request.payload.trigger_prefix {
        final_prompt = format!("{}, {}", prefix, final_prompt);
    }
    if let Some(suffix) = &request.payload.trigger_suffix {
        final_prompt = format!("{} {}", final_prompt, suffix);
    }

    let client = reqwest::Client::new();

    let payload = json!({
        "model": "black-forest-labs/FLUX.1-dev-lora",
        "prompt": final_prompt,
        "width": request.payload.width,
        "height": request.payload.height,
        "steps": request.payload.steps,
        "seed": request.payload.seed,
        "response_format": "base64",
        "image_loras": [{
            "path": request.payload.lora_path,
            "scale": request.payload.lora_scale,
        }]
    });

    info!("Sending request to Together AI: {:?}", payload);

    let response = client
        .post("https://api.together.xyz/v1/images/generations")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&payload)
        .send()
        .await
        .map_err(|e| EnclaveError::GenericError(format!("Failed to send request: {}", e)))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(EnclaveError::GenericError(format!(
            "Together AI API error: {}",
            error_text
        )));
    }

    let response_json: Value = response
        .json()
        .await
        .map_err(|e| EnclaveError::GenericError(format!("Failed to parse response: {}", e)))?;

    let image_base64 = response_json["data"][0]["b64_json"]
        .as_str()
        .ok_or_else(|| EnclaveError::GenericError("Missing image data in response".to_string()))?
        .to_string();

    // do a credit call, deduct 10 kisses from user, add 2 kisses to model creator
    let admin_secret = std::env::var("ADMIN_SECRET")
        .map_err(|_| EnclaveError::GenericError("ADMIN_SECRET not set".to_string()))?;
    
    // Extract model_creator and model_name from HuggingFace URL
    // Format: https://huggingface.co/{author}/{model}
    let path_parts: Vec<&str> = request.payload.lora_path.split('/').collect();
    let model_creator = if path_parts.len() >= 4 {
        path_parts[path_parts.len() - 2]
    } else {
        "unknown"
    };
    let model_name = if path_parts.len() >= 4 {
        path_parts[path_parts.len() - 1]
    } else {
        "unknown"
    };
    
    println!("Lora path: {}", request.payload.lora_path);
    println!("Model creator: {}", model_creator);
    println!("Model name: {}", model_name);
    println!("User address: {}", user_address);
    
    let credit_payload = json!({
        "admin_secret": admin_secret,
        "model_creator": model_creator,
        "model_name": model_name,
        "user_address": user_address,
    });

    println!("Credit payload: {}", serde_json::to_string_pretty(&credit_payload).unwrap());

    let credit_response = client
        .post(format!("{}/api/credit", frontend_url))
        .json(&credit_payload)
        .send()
        .await
        .map_err(|e| EnclaveError::GenericError(format!("Failed to deduct credits: {}", e)))?;

    if !credit_response.status().is_success() {
        let error_text = credit_response.text().await.unwrap_or_default();
        return Err(EnclaveError::GenericError(format!(
            "Credit deduction failed: {}",
            error_text
        )));
    }

    // Get current timestamp in milliseconds for the response
    let current_timestamp_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| EnclaveError::GenericError(format!("Failed to get current timestamp: {}", e)))?
        .as_millis() as u64;

    // Upload to Walrus (optional - don't fail if upload fails)
    if let Ok(endpoint_key) = std::env::var("WALRUS_ENDPOINT_KEY") {
        if !endpoint_key.is_empty() {
            match upload_to_walrus(&image_base64).await {
                Ok(walrus_url) => {
                    println!("✓ Image uploaded to Walrus: {}", walrus_url);
                }
                Err(e) => {
                    println!("⚠ Walrus upload failed (continuing anyway): {}", e);
                }
            }
        }
    } else {
        println!("ℹ Skipping Walrus upload (WALRUS_ENDPOINT_KEY not set)");
    }

    Ok(Json(to_signed_response(
        &state.eph_kp,
        ImageGenResponse {
            image: image_base64,
            prompt: final_prompt,
            seed: request.payload.seed,
        },
        current_timestamp_ms,
        IntentScope::ProcessData,
    )))
}
