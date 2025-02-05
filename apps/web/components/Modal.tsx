import { useState } from "react";
import { useRouter } from "next/navigation";

function Modal({ onSelect }: { onSelect: (value: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevent page refresh

    // Validation check
    if (!name.trim() || !roomId.trim()) {
      alert("Please enter both Name and Room Name.");
      return;
    }

    // Redirect if validation passes
    router.push(`/room?name=${encodeURIComponent(name)}&roomId=${encodeURIComponent(roomId)}`);
    onSelect(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/10 backdrop-blur-sm">
      <div className="relative p-4 w-full max-w-md bg-[var(--modalBackground)] rounded-lg shadow-sm dark:bg-[var(--modalBackground)] border border-gray-400">
        {/* Modal header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600 rounded-t">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Create new meet</h3>
          <button
            type="button"
            onClick={() => onSelect(false)}
            className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
          >
            <svg
              className="w-3 h-3"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 14 14"
            >
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 1l6 6m0 0l6 6M7 7l6-6M7 7l-6 6" />
            </svg>
            <span className="sr-only">Close modal</span>
          </button>
        </div>

        {/* Modal body */}
        <div className="p-4 md:p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                Enter your name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-zinc-800 border border-zinc-500 text-zinc-400 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-zinc-800 dark:border-zinc-500 dark:placeholder-zinc-400 dark:text-white"
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <label htmlFor="room" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                Enter room name
              </label>
              <input
                type="text"
                id="room"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="bg-zinc-800 border border-zinc-500 text-zinc-400 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-zinc-800 dark:border-zinc-500 dark:placeholder-zinc-400 dark:text-white"
                placeholder="e.g. Room123"
                required
              />
            </div>
            <div className="flex justify-center items-center">
              <button
                type="submit"
                className="w-full mt-4 text-white bg-blue-800 hover:bg-blue-900 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-800 dark:hover:bg-blue-900 dark:focus:ring-blue-800"
              >
                Launch Room
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Modal;
