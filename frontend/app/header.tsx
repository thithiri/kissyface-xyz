import Image from "next/image";
import logo from "@/public/logo.png";

export default function Header() {
  return (
    <div className="flex flex-col items-center">
      <a href="https://kissyface.xyz" target="_blank" className="flex items-center gap-2">
        <Image alt="" className="h-14 w-auto" src={logo} />
        <span className="text-3xl font-bold tracking-tight">Kissy Face</span>
      </a>
      <p className="font-mono text-center text-gray-600 px-4 mt-2">Beautiful images 🖼️ for you.<br />Rewards 💋 for creators.</p>
    </div>
  );
}
