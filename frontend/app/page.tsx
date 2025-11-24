"use client";

import PictureIcon from "@/components/icons/picture-icon";
import Spinner from "@/components/spinner";
import * as RadioGroup from "@radix-ui/react-radio-group";
import imagePlaceholder from "@/public/image-placeholder.png";
import heroImage from "@/public/hero-image.png";
import w1 from "@/public/w1.png";
import w2 from "@/public/w2.png";
import w3 from "@/public/w3.png";
import {
  CheckCircleIcon,
  InformationCircleIcon,
} from "@heroicons/react/20/solid";
import { ArrowDownIcon } from "@heroicons/react/16/solid";
import { ArrowUpIcon } from "@heroicons/react/16/solid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@uidotdev/usehooks";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { LORAS } from "../data/loras";
import { ConnectButton, useCurrentAccount, useSignPersonalMessage } from "@mysten/dapp-kit";
import Header from "./header";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { Tusky } from "@tusky-io/ts-sdk/web";


export default function Home() {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [selectedLoraModel, setSelectedLoraModel] = useState<string>("");
  const [submittedLoraModel, setSubmittedLoraModel] = useState<string>("");
  const [userAPIKey, setUserAPIKey] = useState("");
  const [seed, setSeed] = useState(0);
  const [submittedSeed, setSubmittedSeed] = useState(0);
  useDebounce(prompt, 350);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const promptInputRef = useRef<HTMLDivElement>(null);
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();

  const selectedLora = LORAS.find((l) => l.model === selectedLoraModel);
  const submittedLora = LORAS.find((l) => l.model === submittedLoraModel);

  let fetchBalance = true;
  let fetchCreatorBalances = true;
  const [uploadingToWalrus, setUploadingToWalrus] = useState(false);
  const [walrusUrl, setWalrusUrl] = useState<string | null>(null);

  function generateRandomSeed() {
    return Math.floor(Math.random() * 1000000);
  }

  function getTodayDate() {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  useEffect(() => {
    setSeed(generateRandomSeed());
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (userAPIKey) {
        localStorage.setItem("togetherApiKey", userAPIKey);
      } else {
        localStorage.removeItem("togetherApiKey");
      }
    }
  }, [userAPIKey]);

  useEffect(() => {
    const key = localStorage.getItem("togetherApiKey") ?? "";
    setUserAPIKey(key);
  }, []);

  useEffect(() => {
    async function checkAndSign() {
      if (currentAccount) {
        const today = getTodayDate();
        const storedDataStr = localStorage.getItem("userSignatureData");
        let shouldSign = true;

        if (storedDataStr) {
          try {
            const storedData = JSON.parse(storedDataStr);
            if (storedData.date === today && storedData.address === currentAccount.address) {
              shouldSign = false;
            }
          } catch (e) {
            console.error("Error parsing signature data", e);
          }
        }

        if (shouldSign) {
          try {
            const messageStr = `I support AI model creators! ${today}`;
            const message = new TextEncoder().encode(messageStr);
            const result = await signPersonalMessage({ message });
            
            const dataToStore = {
              signature: result.signature,
              date: today,
              address: currentAccount.address
            };
            localStorage.setItem("userSignatureData", JSON.stringify(dataToStore));
            // Clean up old key if exists
            localStorage.removeItem("signature");
          } catch (error) {
            console.error("Failed to sign message:", error);
          }
        }
      }
    }
    checkAndSign();
  }, [currentAccount, signPersonalMessage]);

  const { data: creditData } = useQuery({
    queryKey: ["credit", currentAccount?.address],
    queryFn: async () => {
      if (!currentAccount?.address) return { kisses: 0 };
      const res = await fetch(`/api/credit?user_id=${currentAccount.address}`);
      if (!res.ok) throw new Error("Failed to fetch credit");
      fetchBalance = false;
      return res.json();
    },
    enabled: !!currentAccount?.address && fetchBalance,
  });

  // Fetch all model creator balances
  const { data: creatorBalances } = useQuery({
    queryKey: ["creatorBalances"],
    queryFn: async () => {
      const res = await fetch(`/api/credit?user_id=/`);
      if (!res.ok) throw new Error("Failed to fetch creator balances");
      return res.json() as Promise<Record<string, number>>;
    },
    enabled: fetchCreatorBalances,
  });

  const { data, isFetching } = useQuery({
    placeholderData: (previousData) => previousData,
    queryKey: [submittedPrompt, submittedLoraModel, userAPIKey, submittedSeed],
    queryFn: async () => {
      if (!submittedLora) throw new Error("No LoRA model selected");

      const today = getTodayDate();
      const storedDataStr = localStorage.getItem("userSignatureData");
      let signature = null;

      if (storedDataStr && currentAccount) {
        try {
          const storedData = JSON.parse(storedDataStr);
          if (storedData.date === today && storedData.address === currentAccount.address) {
            signature = storedData.signature;
          }
        } catch (e) {
          console.error("Error parsing signature data", e);
        }
      }

      if (!signature) throw new Error("Please sign the message to generate images.");

      let res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/process_data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: {
            prompt: submittedPrompt,
            width: submittedLora.width ?? 1024,
            height: submittedLora.height ?? 768,
            steps: submittedLora.steps,
            seed: submittedSeed,
            lora_path: submittedLora.path,
            lora_scale: submittedLora.scale,
            refinement_instruction: typeof submittedLora.refinement === 'string' ? submittedLora.refinement : null,
            trigger_prefix: submittedLora.trigger_prefix,
            trigger_suffix: submittedLora.trigger_suffix,
            signature,
            date: today,
          }
        }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message);
      }

      let data = await res.json();

      fetchBalance = true;

      fetchCreatorBalances = true;
      
      return {
        prompt: data.response.data.prompt,
        image: {
          b64_json: data.response.data.image,
          timings: { inference: 0 },
          seed: data.response.data.seed,
        }
      };
    },
    enabled: !!(submittedPrompt.trim() && submittedLoraModel),
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (!isFetching && data) {
      queryClient.invalidateQueries({ queryKey: ["credit"] });
    }
  }, [isFetching, data, queryClient]);

  return (
    <div className="h-full">
      <div className="h-full">
        <fieldset className="flex grow flex-col md:h-full md:flex-row md:overflow-hidden">
          <div className="w-full bg-gray-100 md:max-w-sm md:overflow-y-auto">
            <div className="mt-4 md:hidden">
              <Header />
            </div>
            <div className="p-5">
              <div className="flex flex-col gap-8">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <p className="font-mono font-medium tracking-tight">
                      Step 1 of 2: Select a LoRA model
                    </p>
                  </div>
                  <RadioGroup.Root
                    name="lora"
                    value={selectedLoraModel}
                    onValueChange={(val) => {
                      setSelectedLoraModel(val);
                      setTimeout(() => {
                        promptInputRef.current?.scrollIntoView({
                          behavior: "smooth",
                        });
                        textAreaRef.current?.focus();
                      }, 200);
                    }}
                    className="mt-4 grid grid-cols-1 gap-x-5 gap-y-3"
                  >
                    {LORAS.map((lora) => (
                      <div
                        className="relative [&_input]:inset-0 [&_input]:!translate-x-0"
                        key={lora.model}
                      >
                        <RadioGroup.Item
                          value={lora.model}
                          className="group relative flex w-full items-start gap-2 rounded-lg border border-gray-200 bg-white p-2 text-left shadow-sm hover:bg-gray-50 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 data-[state=checked]:border-blue-500 data-[state=checked]:ring-1 data-[state=checked]:ring-blue-500"
                          required
                        >
                          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md">
                            <Image
                              className="h-full w-full object-cover"
                              src={lora.image}
                              alt={lora.name}
                              fill
                            />
                          </div>
                          <div className="flex flex-1 flex-col">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900">
                                {lora.name} <span className="text-sm text-gray-500">({creatorBalances?.[lora.author +"/"+ lora.model] ? `${creatorBalances[lora.author +"/"+ lora.model]}` : '0'} 💋)</span>
                              </span>
                              <RadioGroup.Indicator>
                                <CheckCircleIcon className="size-5 text-blue-500" />
                              </RadioGroup.Indicator>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">
                                by <span className="text-gray-900 font-semibold">{lora.author}</span>
                              </span>
                              <a
                                href={lora.url}
                                target="_blank"
                                className="text-xs text-gray-400 hover:text-gray-600"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <InformationCircleIcon className="size-3" />
                              </a>
                            </div>
                            <p className="mt-1 text-xs text-gray-600 line-clamp-2">
                              {lora.description}
                            </p>
                          </div>
                        </RadioGroup.Item>
                      </div>
                    ))}
                  </RadioGroup.Root>
                </div>
                <div ref={promptInputRef}>
                  <p className="font-mono font-medium tracking-tight">
                    Step 2 of 2: Describe your image
                  </p>
                  <div className="mt-2 text-sm text-gray-500">
                    Selected model: <span className="font-bold">{selectedLora ? selectedLora.name : "None"}</span>
                  </div>
                  <div className="relative mt-2">
                    <textarea
                      ref={textAreaRef}
                      name="prompt"
                      rows={6}
                      spellCheck={false}
                      placeholder="Your prompt here..."
                      required
                      autoComplete="off"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="block w-full resize-none rounded-md border border-gray-300 bg-white px-4 py-3 text-sm text-gray-600 placeholder-gray-400 hover:border-gray-400/70 focus:outline focus:outline-2 focus:-outline-offset-1 focus:outline-blue-500"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (currentAccount) {
                            setSubmittedPrompt(prompt);
                            setSubmittedLoraModel(selectedLoraModel);
                            setSubmittedSeed(seed);
                          } else {
                            alert("Please connect your wallet first!");
                          }
                        }
                      }}
                    />

                    {selectedLora && (
                      <div className="absolute inset-x-2 bottom-2 flex items-center">
                        <div className="mt-4 flex flex-wrap gap-2">
                          {selectedLora.suggestions.map((suggestion, i) => (
                            <button
                              type="button"
                              key={i}
                              onClick={() => setPrompt(suggestion.prompt)}
                              className="shrink-0 rounded-full bg-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                            >
                              {suggestion.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 z-10 mt-12 -mx-5 bg-gray-100 px-5 pb-5 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (currentAccount) {
                      setSubmittedPrompt(prompt);
                      setSubmittedLoraModel(selectedLoraModel);
                      setSubmittedSeed(seed);
                    } else {
                      alert("Please connect your wallet first!");
                    }
                  }}
                  disabled={isFetching || !prompt || !selectedLoraModel}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-cyan-400 px-4 py-2 font-medium text-gray-100 shadow hover:bg-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50"
                >
                  <PictureIcon className="size-4" />
                  {isFetching ? "Generating..." : "Generate Image"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col px-4 md:min-h-dvh md:overflow-y-auto">
            <div className="mx-auto flex max-w-lg grow flex-col">
              <div className="mt-4 hidden md:block">
                <Header />
              </div>

              <div className="flex justify-between items-center w-full my-4 px-4">
              {!currentAccount ? (
                <motion.div 
                  className="w-full flex justify-center"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ConnectButton connectText="Connect with Sui Wallet" />
                </motion.div>
              ) : (
                <div className="flex grow flex-row gap-10 justify-between items-center w-full">
                  <span>
                    Balance: {creditData?.kisses ?? 0} 💋
                  </span>
                  <span>
                    <ConnectButton connectText="Disconnect"/>
                  </span>  
                </div>
              )}
              </div>

              <div className="flex grow flex-col justify-center py-4">
                <MotionConfig transition={{ duration: 0.2 }}>
                  <div>
                    {submittedPrompt && submittedLora && submittedSeed ? (
                      <AnimatePresence mode="wait">
                        {isFetching ? (
                          <motion.div
                            key="a"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                              aspectRatio:
                                submittedLora?.width && submittedLora?.height
                                  ? submittedLora.width / submittedLora.height
                                  : 4 / 3,
                            }}
                            className="flex h-auto max-w-full items-center justify-center gap-2 rounded-lg text-gray-500"
                          >
                            <Spinner className="size-4" />
                            Generating...
                          </motion.div>
                        ) : data ? (
                          <motion.div
                            key="b"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <div className="flex items-center justify-end gap-2">
                              {walrusUrl && (
                                <a
                                  href={walrusUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 rounded-md bg-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 opacity-75 transition hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                                >
                                  <svg width="16" height="16" viewBox="0 0 153 131" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <g clipPath="url(#clip0_4185_254)">
                                      <path d="M141.912 107.911C146.592 98.5966 151.891 83.8954 151.891 70.3403C151.891 57.3514 148.793 47.3027 142.502 36.6248C141.035 15.5603 127.853 0.000488281 109.106 0.000488281C88.4326 0.000488281 76.4498 18.2698 75.6756 36.3537C55.0171 37.5943 48.6159 57.4069 39.4523 65.6955C25.1067 78.6693 0 78.0843 0 96.8818C0 116.229 25.5707 119.833 58.5373 121.358C59.0933 126.72 69.9603 131.001 83.3238 131.001C95.8551 131.001 106.19 127.236 107.89 122.344C112.444 124.62 119.391 126.077 127.184 126.077C140.903 126.077 152.023 121.569 152.023 116.007C152.023 112.685 148.035 109.746 141.913 107.913L141.912 107.911ZM89.822 82.1151V55.7955C89.822 53.6698 91.5443 51.9462 93.6713 51.9462H97.8749C100.001 51.9462 101.724 53.6698 101.724 55.7955V88.394C101.707 93.6907 101.96 99.7414 104.995 103.085C98.4158 102.063 89.822 96.6953 89.822 82.1151ZM104.851 37.1795H90.1145C89.3845 35.6073 88.9357 33.8056 88.9357 31.8576C88.9357 25.962 92.7623 21.1823 97.4828 21.1823C102.203 21.1823 106.029 25.962 106.029 31.8576C106.029 33.8056 105.582 35.6073 104.851 37.1795ZM115.181 25.986L124.438 21.0927C125.057 20.7674 125.818 21.0032 126.149 21.6198C126.474 22.2376 126.24 23.0054 125.62 23.3307L116.364 28.2239C116.255 28.2807 116.167 28.3576 116.075 28.4307L125.968 27.4271C126.672 27.3527 127.285 27.8646 127.358 28.5593C127.427 29.2553 126.92 29.8756 126.226 29.9475L126.223 29.95L115.825 31.004C116.013 31.2247 116.245 31.4113 116.536 31.5273L125.498 35.1118C126.149 35.3715 126.463 36.1078 126.204 36.7559C126.006 37.2514 125.531 37.5527 125.029 37.5527C124.874 37.5527 124.714 37.5225 124.56 37.4607L115.599 33.8762C114.005 33.2407 112.959 31.7807 112.869 30.0647C112.777 28.3525 113.663 26.7879 115.181 25.986ZM128.293 82.1151C128.293 96.6965 119.701 102.063 113.122 103.085C116.158 99.7427 116.409 93.6907 116.393 88.394V55.7955C116.393 53.6698 118.116 51.9462 120.242 51.9462H124.445C126.571 51.9462 128.295 53.6698 128.295 55.7955L128.293 82.1151Z" fill="#000000"/>
                                    </g>
                                    <defs>
                                      <clipPath id="clip0_4185_254">
                                        <rect width="152.022" height="131" fill="white"/>
                                      </clipPath>
                                    </defs>
                                  </svg>
                                </a>
                              )}
                              {/* Upload to Walrus/Tusky */}
                              <button
                                onClick={async () => {
                                  if (!currentAccount || !data?.image?.b64_json) return;
                                  
                                  setUploadingToWalrus(true);
                                  setWalrusUrl(null);
                                  
                                  try {
                                    // Initialize Tusky
                                    const tusky = new Tusky({ 
                                      wallet: { 
                                        signPersonalMessage, 
                                        account: currentAccount as any // eslint-disable-line @typescript-eslint/no-explicit-any
                                      } 
                                    });
                                    
                                    // Sign in to Tusky
                                    await tusky.auth.signIn();
                                    
                                    // Get or create vault named "kissyface-xyz"
                                    const vaultsResponse = await tusky.vault.list();
                                    let vaultId: string;
                                    const vaultItems = ((vaultsResponse as Record<string, unknown>).items || (vaultsResponse as Record<string, unknown>).data || []) as Array<{ id: string; name: string }>;
                                    
                                    // Search for vault named "kissyface-xyz"
                                    const kissyfaceVault = vaultItems.find((vault) => vault.name === "kissyface-xyz");
                                    
                                    if (kissyfaceVault) {
                                      vaultId = kissyfaceVault.id;
                                    } else {
                                      // Create a new vault named "kissyface-xyz"
                                      const newVault = await tusky.vault.create("kissyface-xyz", {encrypted: false});
                                      vaultId = newVault.id;
                                    }
                                    
                                    // Convert base64 to blob
                                    const base64Response = await fetch(`data:image/png;base64,${data.image.b64_json}`);
                                    const blob = await base64Response.blob();
                                    
                                    // Upload to Walrus via Tusky
                                    const uploadId = await tusky.file.upload(
                                      vaultId,
                                      blob,
                                      {
                                        name: `${data.image.seed}.png`,
                                        mimeType: 'image/png'
                                      }
                                    );
                                    
                                    // Get file metadata with retry logic (wait for blobId)
                                    let fileMetadata: { blobId?: string; id?: string; url?: string } | null = null;
                                    const maxRetries = 5;
                                    const delayMs = 5000; // 5 seconds
                                    
                                    for (let attempt = 0; attempt < maxRetries; attempt++) {
                                      // Wait 5 seconds before checking (including first attempt)
                                      await new Promise(resolve => setTimeout(resolve, delayMs));
                                      
                                      fileMetadata = await tusky.file.get(uploadId);
                                      console.log(`Attempt ${attempt + 1}/${maxRetries} - File metadata:`, fileMetadata);
                                      
                                      // Check if blobId is available
                                      if (fileMetadata.blobId !== "unknown") {
                                        console.log('BlobId found:', fileMetadata.blobId);
                                        break;
                                      }
                                      
                                      if (attempt < maxRetries - 1) {
                                        console.log('BlobId not yet available, retrying in 5 seconds...');
                                      }
                                    }
                                    
                                    if (!fileMetadata?.blobId) {
                                      console.warn('BlobId not available after all retries');
                                    }
                                    
                                    if (fileMetadata?.blobId) {
                                      setWalrusUrl(`https://walrus.tusky.io/${fileMetadata.blobId}`);
                                    }
                                    console.log('Uploaded to Walrus:', fileMetadata);
                                  } catch (error) {
                                    console.error('Failed to upload to Walrus:', error);
                                    alert('Failed to upload to Walrus: ' + (error as Error).message);
                                  } finally {
                                    setUploadingToWalrus(false);
                                  }
                                }}
                                disabled={uploadingToWalrus || !currentAccount}
                                className="flex items-center gap-2 rounded-md bg-cyan-400 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Upload to Walrus decentralized storage"
                              >
                                {uploadingToWalrus ? (
                                  <>
                                    <Spinner className="size-4" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <ArrowUpIcon className="size-4" />
                                    Upload to Tusky.io
                                  </>
                                )}
                              </button>
                              <a
                                href={`data:image/png;base64,${data.image.b64_json}`}
                                title="Download this image"
                                download="image.jpg"
                                className="inline-flex items-center gap-1 rounded-md bg-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 opacity-75 transition hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                              >
                                <ArrowDownIcon className="size-4" />
                                Download
                              </a>
                            </div>
                            <div className="relative mt-2">
                              <Image
                                placeholder="blur"
                                blurDataURL={imagePlaceholder.blurDataURL}
                                width={submittedLora?.width ?? 1024}
                                height={submittedLora?.height ?? 768}
                                src={`data:image/png;base64,${data.image.b64_json}`}
                                alt=""
                                className={`${isFetching ? "animate-pulse" : ""} max-w-full border border-gray-200 object-cover`}
                              />
                            </div>

                            <div className="mt-2 text-center text-sm">
                              <p className="mt-1 text-gray-400">
                                {data.prompt}<br />{`seed : ${data.image.seed}`}
                              </p>
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="mb-4 flex gap-4">
                          <motion.div
                            animate={{ y: [0, -10, 0] }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          >
                            <Image src={w1} alt="" className="w-16" />
                          </motion.div>
                          <motion.div
                            animate={{ y: [0, -10, 0] }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: 0.2,
                            }}
                          >
                            <Image src={w2} alt="" className="w-16" />
                          </motion.div>
                          <motion.div
                            animate={{ y: [0, -10, 0] }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: 0.4,
                            }}
                          >
                            <Image src={w3} alt="" className="w-16" />
                          </motion.div>
                        </div>
                        <div className="flex scale-125 items-center justify-center">
                          <Image
                            className="h-full w-auto"
                            alt=""
                            src={heroImage}
                          />
                          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/20 to-white" />
                        </div>

                        <div className="relative mt-2">
                          <h1 className="text-balance text-4xl font-semibold tracking-tight">
                            Create stylized images in seconds
                          </h1>
                          <p className="mt-3 text-balance px-4 text-center text-gray-500">
                            Enter your prompt, choose a LoRA model, and generate
                            beautiful images.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </MotionConfig>
              </div>
            </div>
            <footer className="mt-16 w-full items-center pb-10 text-center text-xs text-gray-600 md:mt-4 md:flex md:justify-between md:pb-5">
              <p>
                Powered by{" "}
                <a
                  href="https://together.ai"
                  target="_blank"
                  className="font-bold transition hover:text-blue-500"
                >
                  Together.ai
                </a>
                ,{" "}
                <a
                  href="https://huggingface.co/"
                  target="_blank"
                  className="font-bold transition hover:text-blue-500"
                >
                  HuggingFace
                </a>
                ,{" "}
                <a
                  href="https://bfl.ai/models"
                  target="_blank"
                  className="font-bold transition hover:text-blue-500"
                >
                  Flux
                </a>
                ,{" "}
                <a
                  href="https://walrus.xyz"
                  target="_blank"
                  className="font-bold transition hover:text-blue-500"
                >
                  Walrus
                </a>
                ,{" "}
                <a
                  href="https://walrus.xyz"
                  target="_blank"
                  className="font-bold transition hover:text-blue-500"
                >
                  Nautilus
                </a>
                , and{" "}
                <a
                  href="https://sui.io"
                  target="_blank"
                  className="font-bold transition hover:text-blue-500"
                >
                  Sui
                </a>
              </p>
            </footer>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
