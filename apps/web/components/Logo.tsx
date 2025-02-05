import { SiLens } from "react-icons/si";


const Logo = () => {
  return (
    <div className="flex items-center gap-3">
        <div className={`relative inline-flex items-center justify-center px-[1px] py-[1px] rounded bg-gradient-to-r from-blue-600 via-purple-500 to-pink-600`}>
            <button className={`relative flex items-center justify-center w-full h-full font-semibold transition-all duration-300 bg-background rounded`}>
                <SiLens className="text-4xl rounded bg-cyan-400 text-[var(--background)] border-none outline-none" />
            </button>
        </div>
        <span className="text-xl font-semibold">El-Meet</span>
    </div>
  )
}

export default Logo