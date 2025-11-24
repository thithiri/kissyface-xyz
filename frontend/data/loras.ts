import AnimeSketch from "@/public/lora-images/anime-sketch.png";
import ColoredSketch from "@/public/lora-images/colored-sketch.png";
import FluxMidJourney from "@/public/lora-images/flux-midjourney.png";
import Icons from "@/public/lora-images/icons.png";
import LogoDesign from "@/public/lora-images/logo-design.png";
import OutfitGenerator from "@/public/lora-images/outfit-generator.png";
import PencilSketch from "@/public/lora-images/pencil-sketch.png";
import SimpleSketch from "@/public/lora-images/simple-sketch.png";
import TarotCard from "@/public/lora-images/tarot-card.png";
import VectorSketch from "@/public/lora-images/vector-sketch.png";
import { StaticImageData } from "next/image";

export type Lora = {
  id: number;
  name: string;
  author: string,
  model: string;
  description: string;
  url: string;
  image: StaticImageData;
  path: string;
  applyTrigger: (prompt: string) => string;
  trigger_prefix?: string;
  trigger_suffix?: string;
  scale: number;
  steps: number;
  refinement: string | boolean;
  height?: number;
  width?: number;
  suggestions: { prompt: string; label: string }[];
};

export const LORAS: Lora[] = [
  {
    id: 9,
    name: "Icons",
    author: "strangerzonehf",
    model: "Flux-Icon-Kit-LoRA",
    description: "Creates clean, scalable icon sets for UI/UX projects.",
    url: "https://huggingface.co/strangerzonehf/Flux-Icon-Kit-LoRA",
    image: Icons,
    path: "https://huggingface.co/strangerzonehf/Flux-Icon-Kit-LoRA",
    applyTrigger: (prompt) => `Icon Kit, ${prompt}`,
    trigger_prefix: "Icon Kit",
    refinement:
      "Refine the prompt so that it describes an icon that can be used in UI/UX projects. Do not ask for multiple icons.",
    scale: 1,
    steps: 33,
    height: 832,
    width: 1280,
    suggestions: [
      { label: "Red torch", prompt: "A flaming red torch" },
      { label: "Brown briefcase", prompt: "A brown briefcase" },
      { label: "Snow globe", prompt: "A snow globe" },
    ],
  },
  {
    id: 6,
    name: "Logos",
    author: "Shakker-Labs",
    model: "FLUX.1-dev-LoRA-Logo-Design",
    description: "Tailored for professional and minimalist logo creation.",
    url: "https://huggingface.co/Shakker-Labs/FLUX.1-dev-LoRA-Logo-Design",
    image: LogoDesign,
    path: "https://huggingface.co/Shakker-Labs/FLUX.1-dev-LoRA-Logo-Design",
    applyTrigger: (prompt) => `logo, Minimalist, ${prompt}`,
    trigger_prefix: "logo, Minimalist",
    refinement:
      "Refine the prompt so that it describes a professional and minimalist logo. If the prompt describes two items, then just return those two items.",
    scale: 0.8,
    steps: 28,
    suggestions: [
      { label: "Cat and flame", prompt: "cat and flame" },
      {
        label: "Coffee and city",
        prompt: "a cup of coffee and a city skyline",
      },
      { label: "Tree and water", prompt: "A tree and a lake" },
    ],
  },
  {
    id: 7,
    name: "Realism",
    author: "strangerzonehf",
    model: "Flux-Midjourney-Mix2-LoRA",
    url: "https://huggingface.co/strangerzonehf/Flux-Midjourney-Mix2-LoRA",
    description:
      "Mimics MidJourney's style, blending intricate and artistic designs.",
    image: FluxMidJourney,
    path: "https://huggingface.co/strangerzonehf/Flux-Midjourney-Mix2-LoRA",
    applyTrigger: (prompt) => `MJ v6, ${prompt}`,
    trigger_prefix: "MJ v6",
    refinement:
      "Refine that prompt so it mimics MidJourney's style, blending intricate and artistic designs. Edit for photorealism and close-up shots.",
    scale: 1,
    steps: 28,
    suggestions: [
      {
        label: "Banana bread",
        prompt: "banana bread with chocolate chips and pecans",
      },
      {
        label: "Gemstone",
        prompt: "A gemstone under soft lighting",
      },
      {
        label: "Paint palette",
        prompt: "An artist's paint palette smeared with vibrant colors",
      },
    ],
  },
  {
    id: 10,
    name: "Tarot Card",
    author: "multimodalart",
    model: "flux-tarot-v1",
    url: "https://huggingface.co/multimodalart/flux-tarot-v1",
    description: "Produces artistic, mystical tarot card designs.",
    image: TarotCard,
    path: "https://huggingface.co/multimodalart/flux-tarot-v1",
    applyTrigger: (prompt) =>
      `${prompt}, in the style of TOK a trtcrd tarot style`,
    trigger_suffix: "in the style of TOK a trtcrd tarot style",
    refinement: false,
    scale: 1,
    steps: 28,
    suggestions: [
      { label: "Wheel of fortune", prompt: "the wheel of fortune" },
      { label: "Kangaroo", prompt: "a kangaroo" },
      { label: "Moon", prompt: "the moon" },
    ],
  },
  // {
  //   id: 8,
  //   name: "Outfit Generator",
  //   model: "FLUX.1-dev-LoRA-Outfit-Generator",
  //   url: "https://huggingface.co/tryonlabs/FLUX.1-dev-LoRA-Outfit-Generator",
  //   description:
  //     "Generates creative outfit designs for concept art and fashion.",
  //   image: OutfitGenerator,
  //   path: "https://huggingface.co/tryonlabs/FLUX.1-dev-LoRA-Outfit-Generator",
  //   applyTrigger: (prompt) => prompt,
  //   refinement:
  //     "Change the prompt does that it describes a piece of clothing. You need to include each of the following details: color, pattern, fit, style, material, and type.",
  //   scale: 1,
  //   steps: 28,
  //   suggestions: [
  //     { label: "Leather jacket", prompt: "a leather jacket" },
  //     { label: "Red dress", prompt: "a red dress" },
  //     { label: "Scarf", prompt: "a silk scarf" },
  //   ],
  // },

  // {
  //   id: 2,
  //   name: "Simple Sketch",
  //   model: "flux-lora-simple-illustration",
  //   description: "Produces clean and minimalistic sketch-style artwork.",
  //   url: "https://huggingface.co/dvyio/flux-lora-simple-illustration",
  //   image: SimpleSketch,
  //   path: "https://huggingface.co/dvyio/flux-lora-simple-illustration",
  //   applyTrigger: (prompt) =>
  //     `${prompt}, illustration in the style of SMPL, thick black lines on a white background`,
  //   refinement: false,
  //   scale: 1,
  //   steps: 28,
  //   suggestions: [
  //     { label: "Woman", prompt: "a woman" },
  //     { label: "Bicycle", prompt: "a bicycle" },
  //     { label: "San Francisco", prompt: "the San Francisco skyline" },
  //   ],
  // },
  {
    id: 3,
    name: "Vector Sketch",
    author: "mujibanget",
    model: "vector-illustration",
    description:
      "Generates smooth, scalable vector-style sketches ideal for digital designs.",
    url: "https://huggingface.co/mujibanget/vector-illustration",
    image: VectorSketch,
    path: "https://huggingface.co/mujibanget/vector-illustration",
    applyTrigger: (prompt) =>
      `${prompt}, vector illustration with mujibvector style, isolated in a white background`,
    trigger_suffix: "vector illustration with mujibvector style, isolated in a white background",
    refinement: false,
    scale: 1,
    steps: 28,
    suggestions: [
      { label: "Dog", prompt: "cute dog" },
      { label: "Flower", prompt: "a rose" },
      { label: "Lamp", prompt: "a vintage lamp" },
    ],
  },

  {
    id: 1,
    name: "Colored Sketch",
    author: "strangerzonehf",
    model: "Flux-Sketch-Ep-LoRA",
    description: "Creates vibrant, colorful sketch-style illustrations.",
    url: "https://huggingface.co/strangerzonehf/Flux-Sketch-Ep-LoRA",
    image: ColoredSketch,
    path: "https://huggingface.co/strangerzonehf/Flux-Sketch-Ep-LoRA",
    applyTrigger: (prompt) => `ep sketch, ${prompt}`,
    trigger_prefix: "ep sketch",
    refinement:
      "Refine the prompt so that it describes a vibrant, colorful, sketch illustration.",
    scale: 1,
    steps: 33,
    height: 832,
    width: 1280,
    suggestions: [
      { label: "Albert Einstein", prompt: "Albert Einstein" },
      { label: "New York City", prompt: "New York City" },
      { label: "Space", prompt: "Space adventure" },
    ],
  },
  {
    id: 4,
    name: "Pencil Sketch",
    author: "Datou1111",
    model: "shou_xin",
    description: "Adds a realistic pencil-drawn effect to your designs.",
    url: "https://huggingface.co/Datou1111/shou_xin",
    image: PencilSketch,
    path: "https://huggingface.co/hassanelmghari/shou_xin",
    applyTrigger: (prompt) => `shou_xin, pencil sketch ${prompt}`,
    trigger_prefix: "shou_xin, pencil sketch",
    refinement: false,
    scale: 1,
    steps: 28,
    suggestions: [
      { label: "Cat", prompt: "a cat with blue eyes" },
      { label: "Steve Jobs", prompt: "steve jobs" },
      { label: "Books", prompt: "A stack of books" },
    ],
  },
  {
    id: 5,
    name: "Anime Sketch",
    author: "glif",
    model: "anime-blockprint-style",
    description:
      "Combines anime-inspired designs with textured block print aesthetics.",
    url: "https://huggingface.co/glif/anime-blockprint-style",
    image: AnimeSketch,
    path: "https://huggingface.co/glif/anime-blockprint-style",
    applyTrigger: (prompt) => `${prompt} blockprint style`,
    trigger_suffix: "blockprint style",
    refinement:
      "Refine the prompt so that it combines anime inspired designs with textured block print aesthetics. The refinement should only include a description that would exist in both anime and block print.",
    scale: 1,
    steps: 28,
    suggestions: [
      { label: "Young man", prompt: "a young man with glasses" },
      { label: "Paper cranes", prompt: "a flock of paper cranes" },
      { label: "Flower", prompt: "a flower blooming" },
    ],
  },
];

